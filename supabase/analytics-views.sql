-- Baktana English – analytics views over public.events (docs/spec/v2.md §8.4–8.5).
-- KPI definitions and example queries: docs/bi/kpis.md, docs/bi/dashboards.md, docs/bi/content-health.md.
--
-- Run AFTER supabase/schema.sql (which creates public.events), in the Supabase dashboard:
-- SQL Editor → New query → paste → Run. Safe to run again: every statement is idempotent.
--
-- Access: dashboards read these views with the service role only (Supabase Studio, Metabase).
-- Clients (anon / authenticated) can neither read the events table nor any view below.
--
-- Conventions
-- * A "learner" is an anon_id (one install / browser). user_id is only used to tell guests
--   from signed-in learners.
-- * Days are the learner's LOCAL date (events.local_date), so "day 1" means the next calendar
--   day where the learner lives.
-- * Percentages are 0–100 with one decimal. A retention cell is NULL while the day it needs
--   has not happened yet (relative to the newest event in the table).
-- * `identify` is bookkeeping, not activity: it never makes a learner "active".
-- * The heavy views (rolling WAU/MAU, cohorts) are MATERIALIZED and refreshed nightly by
--   public.refresh_analytics_views(); the others are plain views over the raw table.

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------

-- Unit and lesson number from a lesson id: u3l2 → (3, 2). NULL for anything else
-- (review answers, __practice__, checkpoints).
create or replace function public.analytics_unit(lesson_id text)
returns integer language sql immutable set search_path = '' as $$
  select (regexp_match(lesson_id, '^u(\d{1,2})l\d{1,2}$'))[1]::integer
$$;

create or replace function public.analytics_lesson_no(lesson_id text)
returns integer language sql immutable set search_path = '' as $$
  select (regexp_match(lesson_id, '^u\d{1,2}l(\d{1,2})$'))[1]::integer
$$;

-- The lesson a sentence item belongs to: s:u3l1:0 → u3l1. NULL for word items (w:…).
create or replace function public.analytics_item_lesson(item_key text)
returns text language sql immutable set search_path = '' as $$
  select (regexp_match(item_key, '^s:(u\d{1,2}l\d{1,2}):\d+$'))[1]
$$;

-- Percentage with one decimal; NULL when the denominator is 0.
create or replace function public.analytics_pct(num numeric, den numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case when den > 0 then round(100.0 * num / den, 1) end
$$;

-- Indexes the views lean on (the table already has events_created_at and events_anon).
create index if not exists events_name_local_date on public.events (name, local_date);
create index if not exists events_lesson on public.events (lesson_id) where lesson_id is not null;

-- ---------------------------------------------------------------------------------------
-- Learner-day facts (materialized): one row per learner per local day with activity.
-- The building block of DAU/WAU/MAU, retention and review engagement.
-- ---------------------------------------------------------------------------------------
drop materialized view if exists public.v_review_engagement;
drop materialized view if exists public.v_cohort_retention;
drop materialized view if exists public.v_daily_active;
drop materialized view if exists public.analytics_learner_days;

create materialized view public.analytics_learner_days as
select
  e.anon_id,
  e.local_date as day,
  (array_agg(e.platform order by e.client_ts desc) filter (where e.platform is not null))[1] as platform,
  bool_or(e.user_id is not null) as signed_in,
  bool_or(e.name in ('lesson_complete', 'review_complete')) as learned,
  bool_or(e.name = 'review_complete') as reviewed,
  bool_or(e.name = 'lesson_complete' and e.lesson_id = 'u1l1') as completed_u1l1
from public.events e
where e.name <> 'identify'
group by e.anon_id, e.local_date;

create unique index if not exists analytics_learner_days_pk on public.analytics_learner_days (anon_id, day);

-- First app_open per learner (local date) = the learner's cohort.
create or replace view public.analytics_cohorts as
select anon_id, min(local_date) as cohort_day
from public.events
where name = 'app_open'
group by anon_id;

-- ---------------------------------------------------------------------------------------
-- v_daily_active: DAU per day and platform (+ 'all'), guests vs signed in, rolling WAU/MAU.
-- WAU = distinct learners active in the 7 days ending that day, MAU = 30 days.
-- ---------------------------------------------------------------------------------------
create materialized view public.v_daily_active as
with days as (
  select distinct day from public.analytics_learner_days
),
daily as (
  select day, coalesce(platform, 'unknown') as platform,
         count(*) filter (where not signed_in) as guests,
         count(*) filter (where signed_in) as signed_in,
         count(*) as dau
  from public.analytics_learner_days
  group by grouping sets ((day, coalesce(platform, 'unknown')), (day))
),
rolling as (
  select d.day, coalesce(l.platform, 'unknown') as platform,
         count(distinct l.anon_id) filter (where l.day > d.day - 7) as wau,
         count(distinct l.anon_id) as mau
  from days d
  join public.analytics_learner_days l on l.day > d.day - 30 and l.day <= d.day
  group by grouping sets ((d.day, coalesce(l.platform, 'unknown')), (d.day))
)
select daily.day,
       coalesce(daily.platform, 'all') as platform,
       daily.guests, daily.signed_in, daily.dau,
       coalesce(rolling.wau, 0) as wau, coalesce(rolling.mau, 0) as mau
from daily
left join rolling
  on rolling.day = daily.day
 and rolling.platform is not distinct from daily.platform
order by daily.day, platform;

-- ---------------------------------------------------------------------------------------
-- v_cohort_retention: per cohort day (first app_open), % of the cohort that LEARNED
-- (lesson_complete or review_complete) exactly on day 1 / 7 / 30.
-- activation = % of the cohort that completed u1l1 on day 0 (KPI "Activation").
-- ---------------------------------------------------------------------------------------
create materialized view public.v_cohort_retention as
with last_day as (
  select max(day) as day from public.analytics_learner_days
),
per_learner as (
  select c.anon_id, c.cohort_day,
         bool_or(l.learned and l.day = c.cohort_day + 1) as d1,
         bool_or(l.learned and l.day = c.cohort_day + 7) as d7,
         bool_or(l.learned and l.day = c.cohort_day + 30) as d30,
         bool_or(l.completed_u1l1 and l.day = c.cohort_day) as activated
  from public.analytics_cohorts c
  left join public.analytics_learner_days l on l.anon_id = c.anon_id
  group by c.anon_id, c.cohort_day
)
select p.cohort_day,
       count(*) as cohort_size,
       case when p.cohort_day + 1 <= ld.day then public.analytics_pct(count(*) filter (where p.d1), count(*)) end as d1,
       case when p.cohort_day + 7 <= ld.day then public.analytics_pct(count(*) filter (where p.d7), count(*)) end as d7,
       case when p.cohort_day + 30 <= ld.day then public.analytics_pct(count(*) filter (where p.d30), count(*)) end as d30,
       public.analytics_pct(count(*) filter (where p.activated), count(*)) as activation
from per_learner p
cross join last_day ld
group by p.cohort_day, ld.day
order by p.cohort_day;

-- ---------------------------------------------------------------------------------------
-- v_review_engagement: daily share of active learners who finished a review, the average
-- review size, and D7 of that day's cohort split by "reviewed in days 0–6" or not.
-- ---------------------------------------------------------------------------------------
create materialized view public.v_review_engagement as
with last_day as (
  select max(day) as day from public.analytics_learner_days
),
daily as (
  select day, count(*) as dau, count(*) filter (where reviewed) as reviewers
  from public.analytics_learner_days
  group by day
),
sizes as (
  select local_date as day, avg((props ->> 'size')::numeric) as avg_size
  from public.events
  where name = 'review_complete' and jsonb_typeof(props -> 'size') = 'number'
  group by local_date
),
cohort as (
  select c.anon_id, c.cohort_day,
         bool_or(l.reviewed and l.day < c.cohort_day + 7) as week1_reviewer,
         bool_or(l.learned and l.day = c.cohort_day + 7) as d7
  from public.analytics_cohorts c
  left join public.analytics_learner_days l on l.anon_id = c.anon_id and l.day <= c.cohort_day + 7
  group by c.anon_id, c.cohort_day
),
d7 as (
  select cohort_day,
         public.analytics_pct(count(*) filter (where week1_reviewer and d7), count(*) filter (where week1_reviewer)) as d7_reviewers,
         public.analytics_pct(count(*) filter (where not coalesce(week1_reviewer, false) and d7),
                              count(*) filter (where not coalesce(week1_reviewer, false))) as d7_non_reviewers
  from cohort
  group by cohort_day
)
select daily.day, daily.dau, daily.reviewers,
       public.analytics_pct(daily.reviewers, daily.dau) as share,
       round(sizes.avg_size, 1) as avg_size,
       case when daily.day + 7 <= ld.day then d7.d7_reviewers end as d7_reviewers,
       case when daily.day + 7 <= ld.day then d7.d7_non_reviewers end as d7_non_reviewers
from daily
cross join last_day ld
left join sizes on sizes.day = daily.day
left join d7 on d7.cohort_day = daily.day
order by daily.day;

-- ---------------------------------------------------------------------------------------
-- v_lesson_funnel: per lesson, in course order (unit, lesson_no – equal to the course order
-- because new lessons are only appended at the end of a unit).
-- Rates are per lesson_start. first_try_accuracy = % correct first answers in the lesson.
-- ---------------------------------------------------------------------------------------
create or replace view public.v_lesson_funnel as
select e.lesson_id,
       public.analytics_unit(e.lesson_id) as unit,
       public.analytics_lesson_no(e.lesson_id) as lesson_no,
       count(*) filter (where e.name = 'lesson_start') as starts,
       count(*) filter (where e.name = 'lesson_complete') as completes,
       public.analytics_pct(count(*) filter (where e.name = 'lesson_complete'),
                            count(*) filter (where e.name = 'lesson_start')) as completion_rate,
       public.analytics_pct(count(*) filter (where e.name = 'lesson_abandon'),
                            count(*) filter (where e.name = 'lesson_start')) as abandon_rate,
       public.analytics_pct(count(*) filter (where e.name = 'hearts_out'),
                            count(*) filter (where e.name = 'lesson_start')) as hearts_out_rate,
       percentile_cont(0.5) within group (order by e.duration_ms)
         filter (where e.name = 'lesson_complete' and e.duration_ms is not null) as median_duration_ms,
       public.analytics_pct(count(*) filter (where e.name = 'exercise_answer' and e.correct),
                            count(*) filter (where e.name = 'exercise_answer' and e.correct is not null)) as first_try_accuracy,
       count(*) filter (where e.name = 'exercise_answer') as answers
from public.events e
where public.analytics_unit(e.lesson_id) is not null
  and e.name in ('lesson_start', 'lesson_complete', 'lesson_abandon', 'hearts_out', 'exercise_answer')
group by e.lesson_id
order by unit, lesson_no;

-- ---------------------------------------------------------------------------------------
-- v_item_difficulty: per item (w:<wordId> / s:<lessonId>:<index>), lessons and reviews
-- together, items with at least 30 first answers. top_ex_type = the exercise type in which
-- the item was answered wrong most often (NULL if never wrong).
-- ---------------------------------------------------------------------------------------
create or replace view public.v_item_difficulty as
select e.item_key,
       count(*) as attempts,
       public.analytics_pct(count(*) filter (where not e.correct), count(*)) as first_try_error_rate,
       mode() within group (order by e.ex_type) filter (where not e.correct) as top_ex_type
from public.events e
where e.name = 'exercise_answer' and e.item_key is not null and e.correct is not null
group by e.item_key
having count(*) >= 30
order by first_try_error_rate desc, attempts desc;

-- ---------------------------------------------------------------------------------------
-- v_exercise_type_accuracy: first-answer accuracy per unit and exercise type. The unit comes
-- from the lesson, or for a review answer on a sentence from its item key; review answers on
-- words have no unit (NULL row = "review, words").
-- ---------------------------------------------------------------------------------------
create or replace view public.v_exercise_type_accuracy as
select coalesce(public.analytics_unit(e.lesson_id), public.analytics_unit(public.analytics_item_lesson(e.item_key))) as unit,
       e.ex_type,
       count(*) as attempts,
       public.analytics_pct(count(*) filter (where e.correct), count(*)) as accuracy
from public.events e
where e.name = 'exercise_answer' and e.ex_type is not null and e.correct is not null
group by 1, 2
order by 1 nulls last, 2;

-- ---------------------------------------------------------------------------------------
-- v_error_code_accuracy: weekly first-answer accuracy per error code (E1–E27) of the
-- sentence answered (exercise_answer.props.errors). week = Monday of the local week.
-- ---------------------------------------------------------------------------------------
create or replace view public.v_error_code_accuracy as
select date_trunc('week', e.local_date)::date as week,
       code.value as error_code,
       count(*) as attempts,
       public.analytics_pct(count(*) filter (where e.correct), count(*)) as accuracy
from public.events e
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(e.props -> 'errors') = 'array' then e.props -> 'errors' else '[]'::jsonb end
) as code(value)
where e.name = 'exercise_answer' and e.correct is not null and code.value ~ '^E\d{1,2}$'
group by 1, 2
order by 1, (substring(code.value from 2))::integer;

-- ---------------------------------------------------------------------------------------
-- v_signup_funnel: one row. Distinct learners who saw / accepted / dismissed the sign-up
-- prompt, who signed up (any source), the KPI "signed up by the 3rd lesson" (% of all
-- learners with an app_open whose signup_complete came after at most 3 completed lessons),
-- and the prompt funnel by lessonsCompleted at the time of the prompt.
-- ---------------------------------------------------------------------------------------
create or replace view public.v_signup_funnel as
with learners as (
  select count(distinct anon_id) as n from public.events where name = 'app_open'
),
first_signup as (
  select anon_id, min(client_ts) as ts from public.events where name = 'signup_complete' group by anon_id
),
early as (
  select count(*) as n
  from first_signup s
  where (select count(*) from public.events l
         where l.anon_id = s.anon_id and l.name = 'lesson_complete' and l.client_ts <= s.ts) <= 3
),
by_lessons as (
  select coalesce(props ->> 'lessonsCompleted', '?') as lessons_completed,
         count(distinct anon_id) filter (where name = 'signup_prompt_shown') as shown,
         count(distinct anon_id) filter (where name = 'signup_prompt_accepted') as accepted,
         count(distinct anon_id) filter (where name = 'signup_prompt_dismissed') as dismissed
  from public.events
  where name in ('signup_prompt_shown', 'signup_prompt_accepted', 'signup_prompt_dismissed')
  group by 1
)
select
  (select count(distinct anon_id) from public.events where name = 'signup_prompt_shown') as prompt_shown,
  (select count(distinct anon_id) from public.events where name = 'signup_prompt_accepted') as accepted,
  (select count(distinct anon_id) from public.events where name = 'signup_prompt_dismissed') as dismissed,
  (select count(*) from first_signup) as signups,
  (select coalesce(jsonb_object_agg(lessons_completed,
            jsonb_build_object('shown', shown, 'accepted', accepted, 'dismissed', dismissed)
            order by lessons_completed), '{}'::jsonb)
   from by_lessons) as by_lessons_completed,
  (select n from learners) as learners,
  public.analytics_pct((select n from early), (select n from learners)) as signup_by_lesson3_rate;

-- ---------------------------------------------------------------------------------------
-- Nightly refresh of the materialized views (order matters: learner days first).
-- With pg_cron (Database → Extensions → pg_cron):
--   select cron.schedule('refresh-analytics', '15 2 * * *', 'select public.refresh_analytics_views()');
-- ---------------------------------------------------------------------------------------
create or replace function public.refresh_analytics_views()
returns void language plpgsql security definer set search_path = '' as $$
begin
  refresh materialized view public.analytics_learner_days;
  refresh materialized view public.v_daily_active;
  refresh materialized view public.v_cohort_retention;
  refresh materialized view public.v_review_engagement;
end; $$;

-- ---------------------------------------------------------------------------------------
-- Service role only: no client can read analytics.
-- ---------------------------------------------------------------------------------------
revoke all on public.analytics_learner_days, public.analytics_cohorts,
  public.v_daily_active, public.v_cohort_retention, public.v_review_engagement,
  public.v_lesson_funnel, public.v_item_difficulty, public.v_exercise_type_accuracy,
  public.v_error_code_accuracy, public.v_signup_funnel
  from public, anon, authenticated;
revoke all on function public.refresh_analytics_views() from public, anon, authenticated;
