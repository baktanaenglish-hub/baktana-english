# מדדים (KPIs) – Baktana English v2

המסמך מסביר כל מדד מ־§8.4 באפיון (`docs/spec/v2.md`): מה הוא מודד, מאילו אירועים הוא מחושב, באיזה view הוא נמצא ומה היעד.
הגדרות האירועים: [`docs/analytics.md`](../analytics.md). חיבור לדשבורד: [`dashboards.md`](dashboards.md). דוח למורים: [`content-health.md`](content-health.md).

## מוסכמות

- **לומד** = `anon_id` אחד (התקנה או דפדפן). לא סופרים לפי `user_id`, כי רוב הלומדים אורחים. `user_id` משמש רק להפרדה בין אורחים למחוברים.
- **יום** = התאריך המקומי של הלומד (`local_date`). "יום 1" הוא היום הקלנדרי הבא אצל הלומד, לא 24 שעות.
- **קוהורט** = התאריך המקומי של ה־`app_open` הראשון של הלומד.
- **"למד"** ביום מסוים = היה לו `lesson_complete` או `review_complete` באותו יום. פתיחת האפליקציה לבד לא נחשבת שימור.
- **"פעיל"** ביום מסוים = כל אירוע חוץ מ־`identify`.
- אחוזים הם 0–100 עם ספרה אחת אחרי הנקודה. תא שימור הוא `NULL` כל עוד היום שהוא צריך עוד לא הגיע (ביחס לאירוע החדש ביותר בטבלה).
- כל ה־views קוראים רק עם service role (§8.5). לקוח לא יכול לקרוא אותם.

## טבלת המדדים

| מדד                              | הגדרה מדויקת                                                                                                                           | View / עמודה                                            | יעד                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------- |
| **Activation**                   | מתוך הלומדים שה־`app_open` הראשון שלהם היה ביום X: כמה אחוז השלימו את `u1l1` (`lesson_complete`, `lesson_id = 'u1l1'`) באותו יום מקומי | `v_cohort_retention.activation`                         | ≥ 60%                           |
| **D1 / D7 / D30**                | מתוך הקוהורט: כמה אחוז **למדו** בדיוק ביום 1 / 7 / 30 אחרי יום הקוהורט                                                                 | `v_cohort_retention.d1/d7/d30`                          | 35% / 15% / 8%                  |
| **DAU / WAU / MAU**              | לומדים פעילים ביום / ב־7 הימים שמסתיימים ביום הזה / ב־30 הימים. מפוצל לפי פלטפורמה, ושורת `all` לסך הכול                               | `v_daily_active`                                        | מעקב                            |
| **שימוש בחזרה**                  | מתוך ה־DAU: כמה אחוז סיימו חזרה (`review_complete`) באותו יום                                                                          | `v_review_engagement.share`                             | ≥ 25%                           |
| **D7 של משתמשי חזרה מול לא**     | בקוהורט של יום X: D7 של מי שסיים חזרה אחת לפחות בימים 0–6, מול D7 של מי שלא                                                            | `v_review_engagement.d7_reviewers` / `d7_non_reviewers` | גבוה יותר אצל משתמשי חזרה       |
| **Recall בקופסאות 4–5**          | אחוז `correct` ב־`exercise_answer` של חזרה (`lesson_id is null`) כש־`props.box` הוא 4 או 5                                             | שאילתה בהמשך (תלוי ש־ui ישלח `props.box`, Should)       | ≥ 80%                           |
| **דיוק בניסיון ראשון לכל שיעור** | אחוז `correct` מתוך `exercise_answer` (כולם ניסיון ראשון) לפי `lesson_id`                                                              | `v_lesson_funnel.first_try_accuracy`                    | 75–90%                          |
| **דיוק לפי קוד טעות**            | אחוז `correct` לפי כל קוד ב־`props.errors`, לפי שבוע                                                                                   | `v_error_code_accuracy`                                 | יורד מיחידה ליחידה              |
| **נטישה / השלמה לכל שיעור**      | `lesson_abandon` / `lesson_start` ו־`lesson_complete` / `lesson_start`                                                                 | `v_lesson_funnel.abandon_rate` / `completion_rate`      | נטישה < 25%, השלמה ≥ 70%        |
| **Hearts-out**                   | `hearts_out` / `lesson_start` לכל שיעור                                                                                                | `v_lesson_funnel.hearts_out_rate`                       | מעקב                            |
| **המרה להרשמה**                  | מתוך כל הלומדים עם `app_open`: כמה אחוז הגיעו ל־`signup_complete` אחרי 3 שיעורים שהושלמו לכל היותר                                     | `v_signup_funnel.signup_by_lesson3_rate`                | ≥ 20%                           |
| **משפך הצעת ההרשמה**             | לומדים שראו / קיבלו / דחו את ההצעה, לפי `lessonsCompleted` ברגע ההצעה                                                                  | `v_signup_funnel`                                       | מעקב                            |
| **פריטים קשים**                  | פריט (`w:`/`s:`) עם 30 ניסיונות לפחות, לפי שיעור הטעות בניסיון ראשון                                                                   | `v_item_difficulty`                                     | < 40% לכל פריט                  |
| **דיוק לפי סוג תרגיל**           | אחוז `correct` לפי יחידה ו־`ex_type`                                                                                                   | `v_exercise_type_accuracy`                              | `listen` לא נמוך משמעותית מהשאר |

## שאילתות למדדים

### Activation ושימור – 30 הקוהורטים האחרונים

```sql
select cohort_day, cohort_size, activation, d1, d7, d30
from public.v_cohort_retention
order by cohort_day desc
limit 30;
```

### שימור ממוצע משוקלל (כל הקוהורטים שכבר אפשר למדוד)

```sql
select
  round(sum(d1 * cohort_size) filter (where d1 is not null) / nullif(sum(cohort_size) filter (where d1 is not null), 0), 1) as d1,
  round(sum(d7 * cohort_size) filter (where d7 is not null) / nullif(sum(cohort_size) filter (where d7 is not null), 0), 1) as d7,
  round(sum(d30 * cohort_size) filter (where d30 is not null) / nullif(sum(cohort_size) filter (where d30 is not null), 0), 1) as d30,
  round(sum(activation * cohort_size) / nullif(sum(cohort_size), 0), 1) as activation
from public.v_cohort_retention;
```

### Recall בקופסאות 4–5 (חזרה)

```sql
select date_trunc('week', local_date)::date as week,
       count(*) as attempts,
       round(100.0 * count(*) filter (where correct) / nullif(count(*), 0), 1) as recall
from public.events
where name = 'exercise_answer'
  and lesson_id is null
  and jsonb_typeof(props -> 'box') = 'number'
  and (props ->> 'box')::int >= 4
group by 1
order by 1;
```

### שימוש בחזרה ו־D7 של משתמשי חזרה (14 הימים האחרונים)

```sql
select day, dau, reviewers, share, avg_size, d7_reviewers, d7_non_reviewers
from public.v_review_engagement
order by day desc
limit 14;
```

## הערות

- **מקור אחד לשמות אירועים:** `ANALYTICS_EVENT_NAMES` ב־`shared/analytics.ts`, וה־check על `events.name` ב־`supabase/schema.sql`. אירוע חדש מתווסף בשניהם.
- **רענון:** `v_daily_active`, `v_cohort_retention` ו־`v_review_engagement` הם materialized views. הם מתעדכנים כשמריצים `select public.refresh_analytics_views();` (ב־pg_cron כל לילה, ראו `dashboards.md`). שאר ה־views מחושבים בכל קריאה.
- **אובדן אירועים מקובל** (§8.1): תור אופליין של עד 500 אירועים, rate limit של 600 לשעה, ומחיקה אחרי 180 יום. לכן המדדים הם הערכה טובה, לא ספירה מדויקת.
- **opt-out:** לומד שכיבה את האנליטיקה לא נספר בכלל. אם שיעור הכיבוי גבוה, המדדים מוטים לטובת לומדים שהשאירו אותה דולקת.
- **Baseline (§8.7):** שבועיים־שלושה ראשונים של `v_lesson_funnel` על יחידות 1–6 הם קו הבסיס לפני שמשכתבים שיעורים. מומלץ לשמור צילום שלהם:
  `create table public.baseline_lesson_funnel as select now() as taken_at, * from public.v_lesson_funnel;`
  (ואז `revoke all on public.baseline_lesson_funnel from anon, authenticated;`).
