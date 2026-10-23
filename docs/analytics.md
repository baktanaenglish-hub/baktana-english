# אנליטיקה – Baktana English

מסמך מבוא לשכבת האנליטיקה של v2: מה נאסף, איך זה נשלח, איפה זה נשמר ואיך קוראים את זה.
מקור האמת הוא האפיון (`docs/spec/v2.md` §8). פירוט נוסף:

- [`docs/bi/kpis.md`](bi/kpis.md) – כל מדד: הגדרה מדויקת, view, יעד, שאילתות.
- [`docs/bi/dashboards.md`](bi/dashboards.md) – התקנה ב־Supabase, חיבור Studio / Metabase, דשבורד מומלץ ושאילתות לדוגמה.
- [`docs/bi/content-health.md`](bi/content-health.md) – דוח שבועי למורים: אילו שיעורים ופריטים לשכתב.

## 1. עקרונות פרטיות

- **מזהה אנונימי:** `anon_id` הוא UUID אקראי שנוצר במכשיר ונשמר ב־`localStorage['baktana-english:anon-id:v1']`. הוא לא נגזר מאף פרט אישי, ונשאר קבוע בין הפעלות.
- **אף פעם לא נשלחים:** אימייל, שם, כתובת IP, או טקסט שהלומד הקליד או בנה. נשלח רק אם התשובה נכונה (`correct`) ומפתח הפריט (`w:water`, `s:u3l1:0`), שהוא תוכן הקורס ולא קלט של הלומד.
- **הקשר שנשלח:** גרסת האפליקציה, פלטפורמה (`web` / `pwa` / `android`), תאריך מקומי ושעה מקומית (בלי אזור זמן ובלי שניות).
- **`user_id`** לא נשלח מהלקוח לעולם. השרת קובע אותו מה־session (Supabase, `auth.uid()`) או מהטוקן (Express). אצל אורח הוא `null`.
- **Opt-out:** בפרופיל יש מתג "שליחת נתוני שימוש אנונימיים" (`Settings.analytics`, ברירת מחדל דולק). כיבוי מוחק מיד את התור, ושום אירוע לא נאסף עד שמדליקים שוב.
- **שמירה:** אירועים גולמיים נמחקים אחרי 180 יום (`public.purge_old_events()`).

## 2. האירועים

הרשימה הקנונית היא `ANALYTICS_EVENT_NAMES` ב־`shared/analytics.ts`, ואותה רשימה נאכפת ב־check של `events.name`.

| אירוע                                              | מתי                                   | שדות עיקריים                                                                                                         |
| -------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `app_open`                                         | פתיחת האפליקציה, פעם בהפעלה           | props: `guest`, `srsDue`, `lessonsCompleted`                                                                         |
| `onboarding_complete`                              | סיום אונבורדינג                       | props: `dailyGoal`                                                                                                   |
| `lesson_start`                                     | פתיחת שיעור                           | `lessonId`; props: `catchup`, `attempt`                                                                              |
| `exercise_answer`                                  | ניסיון ראשון בכל תרגיל, בשיעור ובחזרה | `lessonId` (null בחזרה), `itemKey`, `exType`, `correct`, `firstTry`; props: `errors` (קודי E), `box` (בחזרה, Should) |
| `lesson_complete`                                  | סיום שיעור                            | `lessonId`, `durationMs`; props: `accuracy`, `mistakes`, `xp`, `heartsLeft`                                          |
| `lesson_abandon`                                   | ✕ באמצע שיעור או חזרה                 | `lessonId`; props: `answered`, `total`, `review`                                                                     |
| `hearts_out`                                       | הלבבות נגמרו בשיעור                   | `lessonId`                                                                                                           |
| `review_start`                                     | פתיחת חזרה                            | props: `due`, `size`, `source`                                                                                       |
| `review_complete`                                  | סיום חזרה                             | `durationMs`; props: `size`, `correct`                                                                               |
| `unit_intro_shown`                                 | הצגת טיפ פתיחה ליחידה                 | props: `unitId`, `trigger`                                                                                           |
| `signup_prompt_shown` / `_accepted` / `_dismissed` | הצעת הרשמה לאורח                      | props: `lessonsCompleted`, `round`                                                                                   |
| `signup_complete`                                  | הרשמה מוצלחת                          | props: `from`                                                                                                        |
| `identify`                                         | אחרי כל התחברות או הרשמה              | — (מקשר את ה־`anon_id` ל־`user_id` בצד השרת)                                                                         |

## 3. מודול הלקוח (`src/lib/analytics.ts`)

```ts
track({ name: 'lesson_start', lessonId: 'u3l1', props: { catchup: false, attempt: 1 } });
identify(); // after sign-in / sign-up
setAnalyticsEnabled(false); // Profile toggle – clears the queue
await flush(); // normally automatic
```

- **`track()`** לא זורק שגיאות ולא חוסם. הוא מנקה את האירוע (שם מוכר, `lessonId` עד 12 תווים, `itemKey` עד 80, `durationMs` בין 0 לשעה, props פרימיטיביים בלבד ופחות מ־1KB), מוסיף הקשר (`anonId`, `ts`, `localDate`, `localHour`, `appVersion`, `platform`) ומכניס לתור ב־`localStorage['baktana-english:events:v1']`.
- **התור** מוגבל ל־500 אירועים, והישנים נזרקים. אם `localStorage` חסום, התור נשמר בזיכרון עד סוף ההפעלה.
- **`flush()`** שולח בקבוצות של עד 50:
  - כשמוגדר Supabase: `insert` לטבלת `events` בעמודות snake_case.
  - אחרת, כשחשבונות פעילים: `POST /api/events` עם `{ events }`, ועם `Authorization` אם הלומד מחובר.
  - אחרת (APK בלי חשבונות): לא שולחים, והתור נשאר מוגבל.
  - אירועים נמחקים מהתור **רק אחרי הצלחה**. שגיאת רשת, 429 או 5xx: מנסים שוב אחר כך. 400 (קבוצה פסולה): הקבוצה נזרקת, כדי שלא תחסום את התור לתמיד.
- **מתי שולחים:** בהפעלה, כשיש 10 אירועים בתור, כשהרשת חוזרת (`online`), כשהאפליקציה עוברת לרקע (`visibilitychange`), וכל 60 שניות.
- **מצב התחלתי:** המודול קורא את `analytics` מ־`baktana-english:settings:v1`, כך שגם אירוע שנשלח לפני ה־`useEffect` של App מכבד את ה־opt-out.

## 4. אחסון

- **Supabase:** טבלת `public.events` ב־`supabase/schema.sql` (בעלים: backend). RLS: הכנסה בלבד ל־`anon` ול־`authenticated`, בלי שום קריאה. Rate limit של 600 אירועים לשעה לכל `anon_id`.
- **Express:** טבלת `events` ב־SQLite ו־`POST /api/events` (בעלים: backend), עם אותו מבנה ואותה ולידציה (`sanitizeEvents`).
- **Views:** `supabase/analytics-views.sql` (בעלים: bi), קריאה עם service role בלבד:

| View                                   | מה יש בו                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `v_daily_active` _(materialized)_      | DAU / WAU / MAU לפי יום ופלטפורמה (+ `all`), אורחים מול מחוברים                           |
| `v_cohort_retention` _(materialized)_  | לכל קוהורט: גודל, Activation, D1 / D7 / D30                                               |
| `v_review_engagement` _(materialized)_ | שיעור המשתמשים בחזרה, גודל חזרה ממוצע, D7 של משתמשי חזרה מול לא                           |
| `v_lesson_funnel`                      | לכל שיעור לפי סדר הקורס: התחלות, השלמות, נטישה, hearts-out, חציון זמן, דיוק בניסיון ראשון |
| `v_item_difficulty`                    | לכל פריט (30 ניסיונות ומעלה): שיעור טעות וסוג התרגיל הבעייתי                              |
| `v_exercise_type_accuracy`             | דיוק לפי יחידה וסוג תרגיל                                                                 |
| `v_error_code_accuracy`                | דיוק שבועי לפי קוד טעות (E1–E27)                                                          |
| `v_signup_funnel`                      | משפך הצעת ההרשמה והמרה עד השיעור השלישי                                                   |

ה־materialized views מתרעננים עם `select public.refresh_analytics_views();` (pg_cron כל לילה, ראו `docs/bi/dashboards.md`).
לבדיקה: `supabase/analytics-seed.sql` מכניס 300 לומדים מדומים (`app_version = 'seed'`).

## 5. איך מוסיפים אירוע חדש

1. backend: מוסיף את השם ל־`ANALYTICS_EVENT_NAMES` ול־check של `events.name` (Supabase ו־SQLite).
2. ui: קורא ל־`track()` מהמקום המתאים.
3. bi: מעדכן את המסמך הזה, את `docs/bi/kpis.md` ואת ה־views אם צריך.
