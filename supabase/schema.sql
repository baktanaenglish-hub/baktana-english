-- Baktana English – database for the Supabase backend (static site + Android app).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again: every statement is idempotent.

-- Display names, filled from the sign-up metadata by the trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  created_at timestamptz not null default now()
);

-- One progress document per learner (same shape as the app's Progress type).
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- XP earned, for the weekly league. Capped per row like the Express server.
create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  xp integer not null check (xp between 0 and 50),
  created_at timestamptz not null default now()
);
create index if not exists xp_events_created_at on public.xp_events (created_at);

-- The learner's pet as their groups see it (shared/pet-design.ts PetBadge), or null. The learner writes it
-- through the "own profile" policy; only fellow group members read it, through group_member_stats.
alter table public.profiles add column if not exists pet jsonb;
alter table public.profiles drop constraint if exists profiles_pet_size;
alter table public.profiles add constraint profiles_pet_size
  check (pet is null or (jsonb_typeof(pet) = 'object' and octet_length(pet::text) <= 600));

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.xp_events enable row level security;

-- Learners only ever see and change their own rows.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- XP rows can only be added (no reading other learners' rows, no edits).
drop policy if exists "add own xp" on public.xp_events;
create policy "add own xp" on public.xp_events
  for insert with check (user_id = auth.uid());

-- Creates the profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 30)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Top 20 learners by XP over the last 7 days. Exposes display names only (never emails).
create or replace function public.weekly_leaderboard()
returns table (rank integer, display_name text, weekly_xp bigint, is_me boolean)
language sql
stable
security definer set search_path = ''
as $$
  select
    (row_number() over (order by sum(e.xp) desc, max(e.created_at) asc))::integer,
    p.display_name,
    sum(e.xp)::bigint,
    coalesce(e.user_id = auth.uid(), false)
  from public.xp_events e
  join public.profiles p on p.id = e.user_id
  where e.created_at >= now() - interval '7 days'
  group by e.user_id, p.display_name
  having sum(e.xp) > 0
  order by 1
  limit 20;
$$;

grant execute on function public.weekly_leaderboard() to anon, authenticated;

-- ============================================================================================
-- v2 additions (docs/spec/v2.md §6.6). Idempotent like everything above.
-- ============================================================================================

-- (1) Keeps lesson ids that newer clients wrote when an older client saves progress without them –
-- except when the save is a progress reset (a newer `resetAt`), which must clear them.
create or replace function public.keep_completed_lessons()
returns trigger language plpgsql set search_path = '' as $$
declare
  new_reset numeric := case when jsonb_typeof(new.data -> 'resetAt') = 'number' then (new.data ->> 'resetAt')::numeric else 0 end;
  old_reset numeric := case when jsonb_typeof(old.data -> 'resetAt') = 'number' then (old.data ->> 'resetAt')::numeric else 0 end;
begin
  if new_reset > old_reset then
    return new;
  end if;
  if jsonb_typeof(old.data -> 'completed') = 'object' then
    new.data := jsonb_set(new.data, '{completed}',
      (old.data -> 'completed') || coalesce(new.data -> 'completed', '{}'::jsonb));
  end if;
  return new;
end; $$;
drop trigger if exists progress_keep_completed on public.progress;
create trigger progress_keep_completed before update on public.progress
  for each row execute function public.keep_completed_lessons();

-- (2) Spaced-repetition state (Should – F14). One row per learner and item key.
create table if not exists public.srs_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 3 and 80),
  box smallint not null check (box between 0 and 5),
  due date not null,
  seen integer not null default 0 check (seen >= 0),
  wrong integer not null default 0 check (wrong >= 0),
  last bigint not null check (last >= 0),
  primary key (user_id, item_key)
);
alter table public.srs_state enable row level security;
drop policy if exists "own srs" on public.srs_state;
create policy "own srs" on public.srs_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Merges uploaded items into the caller's state and returns the full state; the same rules as
-- PUT /api/srs (shared/srs-merge.ts): the newer `last` wins box/due (equal `last` → lower box),
-- seen/wrong take the maximum. Invalid items are skipped, `last` is capped at now, and keys
-- new to the learner are only added while the total stays within 3000 (in key order).
create or replace function public.merge_srs(items jsonb)
returns setof public.srs_state
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  room integer;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if items is null or jsonb_typeof(items) <> 'object' then raise exception 'invalid_srs'; end if;
  if (select count(*) from jsonb_object_keys(items)) > 1000 then raise exception 'too_many_items'; end if;
  room := greatest(0, 3000 - (select count(*) from public.srs_state where user_id = me));

  insert into public.srs_state as s (user_id, item_key, box, due, seen, wrong, last)
  select me, v.key, v.box, v.due, v.seen, v.wrong, v.last
  from (
    select e.key,
           (e.value->>'box')::smallint as box,
           (e.value->>'due')::date as due,
           (e.value->>'seen')::int as seen,
           (e.value->>'wrong')::int as wrong,
           least((e.value->>'last')::bigint, now_ms) as last,
           exists (select 1 from public.srs_state x where x.user_id = me and x.item_key = e.key) as known
    from jsonb_each(items) e
    where jsonb_typeof(e.value) = 'object'
      and e.key ~ '^(w:[^\s].{0,77}|s:u\d{1,2}l\d{1,2}:\d{1,2})$'
      and coalesce(e.value->>'box', '') ~ '^[0-5]$'
      and coalesce(e.value->>'due', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and coalesce(e.value->>'seen', '') ~ '^\d{1,9}$'
      and coalesce(e.value->>'wrong', '') ~ '^\d{1,9}$'
      and coalesce(e.value->>'last', '') ~ '^\d{1,15}$'
  ) v
  where v.due <= current_date + 401
    and (v.known or v.key in (
      select n.key from jsonb_each(items) n
      where not exists (select 1 from public.srs_state x where x.user_id = me and x.item_key = n.key)
      order by n.key collate "C"
      limit room))
  on conflict (user_id, item_key) do update set
    box   = case when excluded.last > s.last or (excluded.last = s.last and excluded.box < s.box) then excluded.box else s.box end,
    due   = case when excluded.last > s.last or (excluded.last = s.last and excluded.box < s.box) then excluded.due else s.due end,
    last  = greatest(s.last, excluded.last),
    seen  = greatest(s.seen, excluded.seen),
    wrong = greatest(s.wrong, excluded.wrong);

  return query select * from public.srs_state where user_id = me;
end; $$;
revoke execute on function public.merge_srs(jsonb) from public, anon;
grant execute on function public.merge_srs(jsonb) to authenticated;

-- (3) Anonymous analytics events (Must – F11). Insert-only; dashboards read with the service role.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name in ('app_open','onboarding_complete','lesson_start','exercise_answer',
    'lesson_complete','lesson_abandon','hearts_out','review_start','review_complete','unit_intro_shown',
    'signup_prompt_shown','signup_prompt_accepted','signup_prompt_dismissed','signup_complete','identify')),
  lesson_id text check (char_length(lesson_id) <= 12),
  item_key text check (char_length(item_key) <= 80),
  ex_type text check (ex_type in ('choice-en','choice-he','match','build-en','build-he','listen')),
  correct boolean, first_try boolean,
  duration_ms integer check (duration_ms between 0 and 3600000),
  props jsonb not null default '{}' check (pg_column_size(props) < 1024),
  client_ts timestamptz not null,
  local_date date not null,
  local_hour smallint not null check (local_hour between 0 and 23),
  app_version text check (char_length(app_version) <= 20),
  platform text check (platform in ('web','pwa','android')),
  created_at timestamptz not null default now()
);
create index if not exists events_created_at on public.events (created_at);
create index if not exists events_anon on public.events (anon_id, created_at);
alter table public.events enable row level security;
drop policy if exists "insert events" on public.events;
create policy "insert events" on public.events
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
-- No select/update/delete policy: clients can never read events.

-- (Should) drop floods: more than 600 events per anon_id in one hour are silently skipped.
create or replace function public.events_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.events
      where anon_id = new.anon_id and created_at > now() - interval '1 hour') >= 600 then
    return null;
  end if;
  return new;
end; $$;
drop trigger if exists events_rate_limit on public.events;
create trigger events_rate_limit before insert on public.events
  for each row execute function public.events_rate_limit();

-- Raw events are kept 180 days. Run daily, e.g. with pg_cron (see docs/supabase.md):
--   select cron.schedule('purge-old-events', '17 3 * * *', 'select public.purge_old_events()');
create or replace function public.purge_old_events()
returns void language sql security definer set search_path = '' as $$
  delete from public.events where created_at < now() - interval '180 days';
$$;
revoke execute on function public.purge_old_events() from public, anon, authenticated;

-- (4) Account deletion from inside the app (required by Google Play and the App Store).
-- Removes the caller's auth user; profiles, progress, xp_events, srs_state, events, call_usage and
-- entitlements (sections 5 and 6, below) all reference auth.users with ON DELETE CASCADE, so everything
-- stored about them goes too. A store subscription is not cancelled by this – the learner does that in
-- Google Play (the app says so before deleting).
-- The app asks for the password again before calling this (src/lib/cloud.ts).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from auth.users where id = auth.uid();
end; $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- (5) AI video-call usage (shared/call.ts CALL_LIMITS): calls and learner turns per learner and
-- Asia/Jerusalem day. Only the call-turn Edge Function touches it, with the service role key:
-- RLS is on with no policies and clients have no privileges, so learners can't read or reset it.
create table if not exists public.call_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls integer not null default 0 check (calls >= 0),
  turns integer not null default 0 check (turns >= 0),
  primary key (user_id, day)
);
alter table public.call_usage enable row level security;
revoke all on public.call_usage from public, anon, authenticated;
grant select, insert, update, delete on public.call_usage to service_role;

-- Checks the daily limits and counts one turn (and one call when p_new_call) in one transaction;
-- the row lock makes concurrent turns of the same learner queue up. Returns
-- {"allowed": true, "reason": null, "calls": <today's calls>} or
-- {"allowed": false, "reason": "calls" | "turns", "calls": <today's calls>}.
create or replace function public.increment_call_usage(
  p_user uuid, p_day date, p_new_call boolean, p_calls_limit integer, p_turns_limit integer)
returns json language plpgsql security invoker set search_path = '' as $$
declare
  r public.call_usage;
begin
  if p_user is null or p_day is null then raise exception 'invalid_call_usage'; end if;
  insert into public.call_usage (user_id, day) values (p_user, p_day) on conflict (user_id, day) do nothing;
  select * into r from public.call_usage where user_id = p_user and day = p_day for update;
  if coalesce(p_new_call, false) and r.calls >= p_calls_limit then
    return json_build_object('allowed', false, 'reason', 'calls', 'calls', r.calls);
  end if;
  if r.turns >= p_turns_limit then
    return json_build_object('allowed', false, 'reason', 'turns', 'calls', r.calls);
  end if;
  update public.call_usage
     set calls = calls + case when coalesce(p_new_call, false) then 1 else 0 end, turns = turns + 1
   where user_id = p_user and day = p_day
  returning * into r;
  return json_build_object('allowed', true, 'reason', null, 'calls', r.calls);
end; $$;
revoke execute on function public.increment_call_usage(uuid, date, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.increment_call_usage(uuid, date, boolean, integer, integer) to service_role;

-- (6) Paid premium (docs/subscriptions.md). The billing-webhook Edge Function writes the learner's
-- subscription here (from RevenueCat, with the service role key) and call-turn reads it: a learner is
-- premium while premium_until (plus a day's grace, shared/premium.ts) is in the future, or when their
-- email is in PREMIUM_EMAILS. Like call_usage, clients have no access at all – the app learns about
-- premium from call-turn's status answer.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium_until timestamptz,              -- null: no premium from a subscription
  source text check (source in ('play', 'app_store', 'web', 'manual')),
  product_id text,
  will_renew boolean,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
revoke all on public.entitlements from public, anon, authenticated;
grant select, insert, update, delete on public.entitlements to service_role;

-- RevenueCat webhook events already handled, so a retried delivery is skipped. Only the event id
-- and type are kept, never who it was about.
create table if not exists public.billing_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;
grant select, insert, update, delete on public.billing_events to service_role;

-- (7) Groups, weekly group challenges and the period leaderboards (shared/groups.ts, docs/groups.md).
-- Clients have no direct access to the group tables: everything goes through the functions below,
-- which check membership and only ever expose display names and group names. A member's XP counts
-- for a group from the moment they joined it. Limits (shared/groups.ts): names 2–30 characters,
-- 5 groups per learner, 30 members per group.
alter table public.xp_events add column if not exists lesson boolean not null default false;
create index if not exists xp_events_user_created on public.xp_events (user_id, created_at);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 30),
  invite_code text not null unique check (invite_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from public, anon, authenticated;

-- Groups left without members go (also after an account is deleted); a group whose owner left
-- passes to its longest-standing member.
create or replace function public.tidy_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.groups g where not exists (select 1 from public.group_members m where m.group_id = g.id);
  update public.groups g set owner_id = (
    select m.user_id from public.group_members m where m.group_id = g.id order by m.joined_at, m.user_id limit 1)
  where g.owner_id is null
     or not exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = g.owner_id);
  return null;
end; $$;
drop trigger if exists group_members_tidy on public.group_members;
create trigger group_members_tidy after delete on public.group_members
  for each statement execute function public.tidy_groups();

create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := regexp_replace(btrim(coalesce(group_name, '')), '\s+', ' ', 'g');
  code text;
  gid uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if char_length(clean) not between 2 and 30 then raise exception 'invalid_name'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if (select count(*) from public.group_members where user_id = me) >= 5 then raise exception 'too_many_groups'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into code from generate_series(1, 6);
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  insert into public.groups (name, invite_code, owner_id) values (clean, code, me) returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end; $$;

create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(code, ''), '[\s-]', '', 'g'));
  gid uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if clean !~ '^[A-HJKMNP-Z2-9]{6}$' then raise exception 'invalid_code'; end if;
  -- Locks the group row, so two friends joining at once can't pass the member limit.
  select id into gid from public.groups where invite_code = clean for update;
  if gid is null then raise exception 'group_not_found'; end if;
  if exists (select 1 from public.group_members where group_id = gid and user_id = me) then
    raise exception 'already_member';
  end if;
  if (select count(*) from public.group_members where group_id = gid) >= 30 then raise exception 'group_full'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if (select count(*) from public.group_members where user_id = me) >= 5 then raise exception 'too_many_groups'; end if;
  insert into public.group_members (group_id, user_id) values (gid, me);
  return gid;
end; $$;

create or replace function public.leave_group(gid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.group_members where group_id = gid and user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
end; $$;

-- The caller's groups with the week's figures for the challenges: XP, finished lessons and
-- member-days with XP (calendar days in Israel time, like shared/groups.ts challengeStats).
create or replace function public.my_groups(week_start timestamptz, week_end timestamptz)
returns table (
  id uuid, name text, invite_code text, member_count integer, is_owner boolean, joined_at timestamptz,
  xp bigint, lessons bigint, active_days bigint
)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.invite_code,
    (select count(*) from public.group_members c where c.group_id = g.id)::integer,
    coalesce(g.owner_id = mine.user_id, false),
    mine.joined_at,
    coalesce(s.xp, 0)::bigint, coalesce(s.lessons, 0)::bigint, coalesce(s.days, 0)::bigint
  from public.group_members mine
  join public.groups g on g.id = mine.group_id
  left join lateral (
    select sum(e.xp) as xp,
      count(*) filter (where e.lesson) as lessons,
      count(distinct e.user_id::text || '|' || (e.created_at at time zone 'Asia/Jerusalem')::date::text)
        filter (where e.xp > 0) as days
    from public.group_members m
    join public.xp_events e on e.user_id = m.user_id
    where m.group_id = g.id and e.created_at >= greatest(week_start, m.joined_at) and e.created_at < week_end
  ) s on true
  where mine.user_id = auth.uid()
  order by mine.joined_at;
$$;

-- A group's own board for a period (null `until` = no end), with each member's shared pet; members only.
-- Dropped first: an older version returned no `pet` column, and the return type can't be changed in place.
drop function if exists public.group_member_stats(uuid, timestamptz, timestamptz);
create or replace function public.group_member_stats(gid uuid, since timestamptz, until timestamptz)
returns table (display_name text, xp bigint, is_me boolean, is_owner boolean, joined_at timestamptz, pet jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid()) then
    raise exception 'not_member';
  end if;
  return query
    select p.display_name,
      coalesce((select sum(e.xp) from public.xp_events e
        where e.user_id = m.user_id and e.created_at >= greatest(since, m.joined_at)
          and e.created_at < coalesce(until, 'infinity')), 0)::bigint,
      m.user_id = auth.uid(),
      m.user_id = g.owner_id,
      m.joined_at,
      p.pet
    from public.group_members m
    join public.groups g on g.id = m.group_id
    join public.profiles p on p.id = m.user_id
    where m.group_id = gid;
end; $$;

-- Every group's size and XP for a period; the client ranks them with shared/groups.ts rankGroups.
create or replace function public.group_totals(since timestamptz, until timestamptz)
returns table (id uuid, name text, member_count integer, total_xp bigint, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
    (select count(*) from public.group_members c where c.group_id = g.id)::integer,
    coalesce(sum(e.xp), 0)::bigint,
    coalesce(bool_or(m.user_id = auth.uid()), false)
  from public.groups g
  join public.group_members m on m.group_id = g.id
  left join public.xp_events e on e.user_id = m.user_id
    and e.created_at >= greatest(since, m.joined_at) and e.created_at < coalesce(until, 'infinity')
  group by g.id, g.name
  having coalesce(sum(e.xp), 0) > 0 or coalesce(bool_or(m.user_id = auth.uid()), false);
$$;

-- The personal league for a period: the top 20, plus the caller's own row when it is lower.
create or replace function public.xp_leaderboard(since timestamptz, until timestamptz)
returns table (rank integer, display_name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select e.user_id, sum(e.xp) as xp, max(e.created_at) as last_at
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
    where e.created_at >= since and e.created_at < coalesce(until, 'infinity')
    group by e.user_id
    having sum(e.xp) > 0
  ), ranked as (
    select (row_number() over (order by t.xp desc, t.last_at asc))::integer as rank, t.user_id, t.xp from totals t
  )
  select r.rank, p.display_name, r.xp::bigint, coalesce(r.user_id = auth.uid(), false)
  from ranked r join public.profiles p on p.id = r.user_id
  where r.rank <= 20 or r.user_id = auth.uid()
  order by r.rank;
$$;

revoke execute on function public.tidy_groups() from public, anon, authenticated;
revoke execute on function public.create_group(text), public.join_group(text), public.leave_group(uuid),
  public.my_groups(timestamptz, timestamptz), public.group_member_stats(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.create_group(text), public.join_group(text), public.leave_group(uuid),
  public.my_groups(timestamptz, timestamptz), public.group_member_stats(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.group_totals(timestamptz, timestamptz), public.xp_leaderboard(timestamptz, timestamptz)
  to anon, authenticated;

-- (8) Head-to-head duels between two friends (shared/duels.ts, docs/groups.md). One learner opens a duel and
-- sends its invite code; the first friend to accept starts a 7-day XP race. Like groups, clients only reach
-- the table through the functions below, which return display names, pets and XP – never ids or emails.
-- Limits (shared/duels.ts): invites expire after 7 days; 3 open invites plus running duels per learner.
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  challenger_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  check ((opponent_id is null) = (starts_at is null)),
  check (opponent_id is distinct from challenger_id)
);
create index if not exists duels_challenger on public.duels (challenger_id);
create index if not exists duels_opponent on public.duels (opponent_id);
alter table public.duels enable row level security;
revoke all on public.duels from public, anon, authenticated;

-- Open invites plus running duels of a learner (shared/duels.ts duelOpen).
create or replace function public.open_duel_count(who uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.duels d
  where (d.challenger_id = who or d.opponent_id = who)
    and case when d.starts_at is null then d.created_at > now() - interval '7 days'
             else d.starts_at > now() - interval '7 days' end;
$$;

create or replace function public.create_duel()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  code text;
  did uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  delete from public.duels where opponent_id is null and created_at <= now() - interval '7 days';
  if public.open_duel_count(me) >= 3 then raise exception 'too_many_duels'; end if;
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into code from generate_series(1, 6);
    exit when not exists (select 1 from public.duels where invite_code = code);
  end loop;
  insert into public.duels (invite_code, challenger_id) values (code, me) returning id into did;
  return did;
end; $$;

create or replace function public.join_duel(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(code, ''), '[\s-]', '', 'g'));
  d public.duels;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if clean !~ '^[A-HJKMNP-Z2-9]{6}$' then raise exception 'invalid_code'; end if;
  -- Locks the row, so two friends accepting at once can't both get in.
  select * into d from public.duels where invite_code = clean for update;
  if d.id is null or d.opponent_id is not null or d.created_at <= now() - interval '7 days' then
    raise exception 'duel_not_found';
  end if;
  if d.challenger_id = me then raise exception 'own_duel'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if public.open_duel_count(me) >= 3 then raise exception 'too_many_duels'; end if;
  update public.duels set opponent_id = me, starts_at = now() where id = d.id;
  return d.id;
end; $$;

-- Withdraws an invite nobody accepted yet (a running duel can't be left).
create or replace function public.cancel_duel(did uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.duels where id = did and challenger_id = auth.uid() and opponent_id is null;
  if not found then raise exception 'not_in_duel'; end if;
end; $$;

-- Every duel of the caller, from their side, with both learners' XP since the start; the client filters
-- and sorts them with shared/duels.ts summarizeDuels.
create or replace function public.my_duels()
returns table (
  id uuid, invite_code text, is_challenger boolean, created_at timestamptz, starts_at timestamptz,
  my_name text, my_pet jsonb, my_xp bigint, opp_name text, opp_pet jsonb, opp_xp bigint
)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select d.*, (d.challenger_id = auth.uid()) as is_challenger,
      case when d.challenger_id = auth.uid() then d.opponent_id else d.challenger_id end as other_id
    from public.duels d
    where d.challenger_id = auth.uid() or d.opponent_id = auth.uid()
  )
  select m.id, m.invite_code, m.is_challenger, m.created_at, m.starts_at,
    me.display_name, me.pet,
    coalesce((select sum(e.xp) from public.xp_events e where e.user_id = auth.uid()
      and e.created_at >= m.starts_at and e.created_at < m.starts_at + interval '7 days'), 0)::bigint,
    other.display_name, other.pet,
    coalesce((select sum(e.xp) from public.xp_events e where e.user_id = m.other_id
      and e.created_at >= m.starts_at and e.created_at < m.starts_at + interval '7 days'), 0)::bigint
  from mine m
  join public.profiles me on me.id = auth.uid()
  left join public.profiles other on other.id = m.other_id;
$$;

revoke execute on function public.open_duel_count(uuid) from public, anon, authenticated;
revoke execute on function public.create_duel(), public.join_duel(text), public.cancel_duel(uuid), public.my_duels()
  from public, anon;
grant execute on function public.create_duel(), public.join_duel(text), public.cancel_duel(uuid), public.my_duels()
  to authenticated;
