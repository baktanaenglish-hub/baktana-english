# דשבורדים – התקנה, חיבור ושאילתות

איך מקימים את שכבת האנליטיקה ב־Supabase, איך מתחברים אליה מ־Supabase Studio או מ־Metabase, ואילו גרפים בונים.
הגדרות המדדים: [`kpis.md`](kpis.md). דוח שבועי למורים: [`content-health.md`](content-health.md). האירועים: [`docs/analytics.md`](../analytics.md).

## 1. התקנה (פעם אחת, ובכל עדכון)

ב־Supabase: **SQL Editor → New query**, ומריצים לפי הסדר:

1. `supabase/schema.sql` – יוצר את טבלת `public.events` (בעלים: backend).
2. `supabase/analytics-views.sql` – פונקציות עזר, ה־views וה־materialized views, ופונקציית הרענון. אפשר להריץ שוב בכל עדכון: הקובץ אידמפוטנטי.
3. (סביבת בדיקה בלבד) `supabase/analytics-seed.sql` – 300 לומדים מדומים ב־45 הימים האחרונים. כל השורות מסומנות `app_version = 'seed'`, ומוחקים אותן כך:
   `delete from public.events where app_version = 'seed'; select public.refresh_analytics_views();`

### רענון לילי

ב־**Database → Extensions** מפעילים את `pg_cron`, ואז מריצים פעם אחת:

```pgsql
-- every night at 02:15 UTC: refresh the materialized views
select cron.schedule('refresh-analytics', '15 2 * * *', 'select public.refresh_analytics_views()');
-- every night at 03:00 UTC: delete raw events older than 180 days (function from schema.sql)
select cron.schedule('purge-events', '0 3 * * *', 'select public.purge_old_events()');
```

בלי pg_cron: מריצים `select public.refresh_analytics_views();` ידנית לפני שמסתכלים על הדשבורד.

## 2. הרשאות

- לקוחות (`anon`, `authenticated`) יכולים **רק להכניס** אירועים, ולא יכולים לקרוא אף שורה (RLS בלי מדיניות select).
- ה־views וה־materialized views עברו `revoke all … from public, anon, authenticated`. גם `refresh_analytics_views()` חסומה ללקוחות.
- **קוראים רק עם service role** או עם משתמש Postgres ייעודי לקריאה (מומלץ ל־Metabase):

```pgsql
-- once, as postgres; choose a strong password and keep it in the BI tool only
create role bi_reader login password '<strong password>';
grant usage on schema public to bi_reader;
grant select on public.v_daily_active, public.v_cohort_retention, public.v_review_engagement,
  public.v_lesson_funnel, public.v_item_difficulty, public.v_exercise_type_accuracy,
  public.v_error_code_accuracy, public.v_signup_funnel, public.events to bi_reader;
grant execute on function public.analytics_unit(text), public.analytics_lesson_no(text),
  public.analytics_item_lesson(text), public.analytics_pct(numeric, numeric) to bi_reader;
-- events has RLS without a select policy: let only bi_reader read the raw rows
-- (the views do not need this – they run as their owner).
create policy "bi reads events" on public.events for select to bi_reader using (true);
```

- אסור לשים את מפתח ה־service role באפליקציה או בקוד צד לקוח. הוא נשאר רק בכלי ה־BI.

## 3. חיבור

### Supabase Studio (הכי פשוט)

**SQL Editor** → מדביקים שאילתה מהמסמך הזה → **Run**. אפשר לשמור כל שאילתה ("Save") ולהציג את התוצאה כגרף (כפתור **Chart** מעל התוצאה). העורך רץ עם הרשאות מלאות, כך שה־revoke לא מפריע.

### Metabase (דשבורד קבוע לצוות)

1. **Admin → Databases → Add database → PostgreSQL**.
2. Host / Port / Database / User: מ־Supabase → **Project Settings → Database → Connection string**. עדיף ה־Session pooler (פורט 5432). משתמש: `bi_reader` (סעיף 2), לא `postgres`.
3. SSL: **Require**.
4. אחרי הסנכרון, ה־views מופיעים כטבלאות (`V Lesson Funnel` וכו'). שאלות פשוטות בונים בעורך הגרפי; השאר כ־**Native query** עם השאילתות שבהמשך.
5. מגדירים את ה־dashboard לרענון יומי (אחרי 02:15 UTC, כשה־materialized views כבר עודכנו).

כל כלי BI אחר שמתחבר ל־Postgres (Grafana, Looker Studio עם connector, Redash) עובד באותה צורה.

## 4. הדשבורד המומלץ

| כרטיס                             | סוג גרף                              | מקור                        |
| --------------------------------- | ------------------------------------ | --------------------------- |
| DAU / WAU / MAU                   | קווים לפי יום (שורת `all`)           | `v_daily_active`            |
| DAU לפי פלטפורמה ואורח/מחובר      | עמודות מוערמות                       | `v_daily_active`            |
| Activation ו־D1/D7/D30 לפי קוהורט | קווים + קו יעד (60/35/15/8)          | `v_cohort_retention`        |
| שימוש בחזרה                       | קו + קו יעד 25%                      | `v_review_engagement.share` |
| D7 משתמשי חזרה מול לא             | שני קווים                            | `v_review_engagement`       |
| משפך שיעורים                      | טבלה עם עיצוב מותנה (אדום מתחת ליעד) | `v_lesson_funnel`           |
| פריטים קשים                       | טבלה                                 | `v_item_difficulty`         |
| דיוק לפי סוג תרגיל                | heatmap: יחידה × סוג                 | `v_exercise_type_accuracy`  |
| דיוק לפי קוד טעות                 | קווים לפי שבוע                       | `v_error_code_accuracy`     |
| משפך הרשמה                        | מספרים + עמודות                      | `v_signup_funnel`           |

## 5. שאילתות לדוגמה

### DAU, WAU, MAU – 30 הימים האחרונים

```sql
select day, dau, wau, mau, guests, signed_in
from public.v_daily_active
where platform = 'all'
order by day desc
limit 30;
```

### פילוח פלטפורמות בשבוע האחרון

```sql
select platform, sum(dau) as learner_days, round(avg(dau), 1) as avg_dau
from public.v_daily_active
where platform <> 'all' and day > current_date - 7
group by platform
order by learner_days desc;
```

### משפך השיעורים, עם סימון חריגות

```sql
select lesson_id, starts, completion_rate, abandon_rate, hearts_out_rate, first_try_accuracy,
       round(median_duration_ms / 1000) as median_seconds,
       case
         when first_try_accuracy < 60 or first_try_accuracy > 95 then 'לשכתב (דיוק)'
         when completion_rate < 70 or abandon_rate > 25 then 'שיעור גישור'
         else 'תקין'
       end as status
from public.v_lesson_funnel
order by unit, lesson_no;
```

### השלמה ממוצעת לכל יחידה

```sql
select unit,
       sum(starts) as starts,
       round(100.0 * sum(completes) / nullif(sum(starts), 0), 1) as completion_rate,
       round(avg(first_try_accuracy), 1) as avg_first_try_accuracy
from public.v_lesson_funnel
group by unit
order by unit;
```

### עשרת הפריטים הקשים ביותר

```sql
select item_key, attempts, first_try_error_rate, top_ex_type
from public.v_item_difficulty
order by first_try_error_rate desc
limit 10;
```

### דיוק לפי סוג תרגיל (טבלת ציר)

```sql
select unit,
       max(accuracy) filter (where ex_type = 'choice-en') as choice_en,
       max(accuracy) filter (where ex_type = 'choice-he') as choice_he,
       max(accuracy) filter (where ex_type = 'match') as match,
       max(accuracy) filter (where ex_type = 'build-en') as build_en,
       max(accuracy) filter (where ex_type = 'build-he') as build_he,
       max(accuracy) filter (where ex_type = 'listen') as listen
from public.v_exercise_type_accuracy
group by unit
order by unit nulls last;
```

### משפך הרשמה

```sql
select learners, prompt_shown, accepted, dismissed, signups, signup_by_lesson3_rate,
       round(100.0 * accepted / nullif(prompt_shown, 0), 1) as prompt_accept_rate,
       by_lessons_completed
from public.v_signup_funnel;
```

### מקור ההרשמה (הצעה / פרופיל / אונבורדינג)

```sql
select coalesce(props ->> 'from', '?') as source, count(distinct anon_id) as learners
from public.events
where name = 'signup_complete'
group by 1
order by 2 desc;
```

### בדיקת בריאות של הצנרת – אירועים לפי שם וגרסה ב־7 הימים האחרונים

```sql
select app_version, name, count(*) as events, count(distinct anon_id) as learners
from public.events
where created_at > now() - interval '7 days'
group by app_version, name
order by app_version, events desc;
```

### שעות הלמידה (מתי לשלוח תזכורת בעתיד)

```sql
select local_hour, count(distinct anon_id) as learners
from public.events
where name in ('lesson_complete', 'review_complete') and local_date > current_date - 28
group by local_hour
order by local_hour;
```
