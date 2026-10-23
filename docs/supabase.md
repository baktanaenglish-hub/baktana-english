# התחברות באתר ובאפליקציה (Supabase)

לאתר ב־GitHub Pages ולאפליקציית האנדרואיד אין שרת משלהם. לכן ההרשמה, ההתחברות, סנכרון ההתקדמות והליגה עובדים שם דרך [Supabase](https://supabase.com), שירות חינמי של התחברות ומסד נתונים.
כל עוד Supabase לא מוגדר, האתר והאפליקציה ממשיכים לעבוד במצב אורח בלבד, בלי כפתורי התחברות.

## הקמה (פעם אחת, בערך 5 דקות)

1. **פותחים פרויקט:** נרשמים ב־https://supabase.com, לוחצים **New project**, בוחרים שם (למשל `baktana-english`), סיסמה למסד הנתונים (שומרים אותה בצד) ואזור קרוב (למשל Frankfurt).
2. **יוצרים את הטבלאות:** בתפריט הצד נכנסים ל־**SQL Editor** ← **New query**, מדביקים את כל התוכן של [`supabase/schema.sql`](../supabase/schema.sql) ולוחצים **Run**.
3. **מגדירים כתובות:** ב־**Authentication** ← **URL Configuration**:
   - **Site URL**: `https://baktanaenglish-hub.github.io/baktana-english/` (בדיוק כך – עם `/baktana-english/` בסוף. בלי זה הקישור במייל האישור מוביל לדף 404)
   - אחרי המעבר לדומיין משלנו, Site URL הוא `https://baktanaenglish.co.il/`, ומוסיפים גם אותו ל־Redirect URLs ([domain.md](domain.md)).
   - **Redirect URLs** ← **Add URL**: `https://baktanaenglish-hub.github.io/baktana-english/**` (ולפיתוח מקומי גם `http://localhost:5173/**`). האפליקציה מבקשת מ־Supabase להחזיר לשם את מי שלוחץ על הקישור במייל, וכתובת שלא ברשימה מוחלפת ב־Site URL.
   - אופציונלי: ב־**Authentication** ← **Sign In / Providers** ← **Email** אפשר לכבות את **Confirm email**. אז נרשמים בלי מייל אישור. אם משאירים אותו פעיל, כל משתמש חדש מקבל מייל ולוחץ על הקישור לפני ההתחברות הראשונה.
4. **מעתיקים שני ערכים:** ב־**Project Settings** ← **API** (או **Data API**):
   - **Project URL**, למשל `https://abcd1234.supabase.co`
   - **anon public key** (מפתח ארוך שמתחיל ב־`eyJ`, או מפתח publishable שמתחיל ב־`sb_publishable_`)

   שני הערכים האלה **ציבוריים** ומיועדים לאתר. ההגנה על הנתונים היא ב־Row Level Security שמוגדר ב־`schema.sql`. אסור להשתמש במפתח `service_role`, שהוא סודי.
5. **שומרים אותם ב־GitHub:** ב־repo נכנסים ל־**Settings** ← **Secrets and variables** ← **Actions** ← לשונית **Variables** ← **New repository variable**, ויוצרים שני משתנים:
   - `VITE_SUPABASE_URL` = ה־Project URL
   - `VITE_SUPABASE_ANON_KEY` = ה־anon key
6. **מפרסמים מחדש:** ב־**Actions** מריצים את **Deploy to GitHub Pages** ואת **Android APK** (‏Run workflow), או פשוט ממזגים את השינוי הבא ל־`main`.

## מה נשמר ואיך זה מוגן

| טבלה | תוכן | מי רואה |
|---|---|---|
| `profiles` | שם התצוגה | רק המשתמש עצמו |
| `progress` | מסמך ההתקדמות (XP, שיעורים, רצף) | רק המשתמש עצמו |
| `xp_events` | נקודות שנצברו, לליגה | אף אחד ישירות. הליגה נקראת דרך הפונקציה `weekly_leaderboard`, שמחזירה רק שם תצוגה ו־XP (אף פעם לא אימייל) |
| `srs_state` (v2) | מצב החזרה המרווחת, שורה לכל מילה/משפט | רק המשתמש עצמו. הכתיבה דרך הפונקציה `merge_srs` (אותם כללי מיזוג כמו `PUT /api/srs`) |
| `groups`, `group_members` | קבוצות וחברות בהן ([groups.md](groups.md)) | אף אחד ישירות. הכול דרך הפונקציות `create_group`, `join_group`, `leave_group`, `my_groups`, `group_member_stats`, `group_totals`, `xp_leaderboard`, שבודקות חברות ומחזירות רק שמות |
| `duels` | תחרויות ראש בראש ([groups.md](groups.md)) | אף אחד ישירות. הכול דרך `create_duel`, `join_duel`, `cancel_duel`, `my_duels`, שמחזירות רק שמות תצוגה, חיות ו־XP של שני הצדדים |
| `profiles.pet` | החיה האישית כפי שחברי הקבוצה רואים אותה ([pets.md](spec/pets.md)) | הלומד מעדכן את הפרופיל שלו. אחרים רואים אותה רק דרך `group_member_stats`. **דורש הרצה חוזרת של `schema.sql`** – עד אז החיות לא יופיעו בקבוצות, ושאר האפליקציה ממשיכה לעבוד |
| `events` (v2) | אירועי אנליטיקה אנונימיים | אף לקוח לא יכול לקרוא (insert בלבד, גם לאורח). הדשבורדים קוראים עם ה־service role |

כללי המיזוג והבדיקות (שיעור נעול, תקרת XP לשיעור, תאריך מקומי סביר) זהים לשרת ה־Express ומגיעים מאותו קובץ: `shared/progress-merge.ts`.
**מגבלה ידועה:** בגרסת Supabase הכללים רצים בצד הלקוח, ולכן משתמש מתוחכם יכול לנפח את ה־XP שלו בליגה. ה־XP מוגבל ל־50 לכל רשומה, אבל זה לא מונע ניפוח. אם הליגה תהיה חשובה, אפשר להעביר את הלוגיקה ל־Edge Function.

## מחיקת חשבון

הפונקציה `delete_my_account()` מוחקת את המשתמש המחובר מ־`auth.users`, וכל הטבלאות למעלה נמחקות איתו (`on delete cascade`). האפליקציה מבקשת את הסיסמה שוב לפני הקריאה (`src/lib/cloud.ts`). מי שכבר הריץ את `schema.sql` צריך להריץ אותו שוב כדי שהפונקציה תיווצר. בלי זה כפתור "מחיקת החשבון" יחזיר שגיאה.
בקשת מחיקה שמגיעה במייל (משתמש בלי גישה לאפליקציה): Authentication ← Users ← בוחרים את המשתמש ← Delete user. גם כאן כל הנתונים נמחקים איתו.

## עדכון לגרסה 2

מריצים שוב את כל `supabase/schema.sql` ב־SQL Editor (בטוח להריץ שוב – הכול אידמפוטנטי). **הסדר בפריסה:** קודם ה־SQL, אחר כך שרת ה־Express, ורק אז האתר וה־APK.

מה נוסף:
- **`keep_completed_lessons`** – טריגר על `progress`: כשלקוח ישן שומר התקדמות בלי שיעורים שנוספו בגרסה חדשה (למשל `u7l1`), המפתחות האלה נשמרים. כך APK ישן לא מוחק התקדמות.
- **`srs_state` + `merge_srs(items jsonb)`** – מצב החזרה המרווחת. `merge_srs` ממזג פריט־פריט (ה־`last` החדש מנצח; ב־`last` שווה – הקופסה הנמוכה; `seen`/`wrong` – מקסימום), מדלג על פריטים לא תקינים, מוגבל ל־1000 פריטים לקריאה ול־3000 ללומד (פריטים חדשים מעבר לתקרה לא נשמרים), ומחזיר את המצב המלא.
- **`events`** – אירועי אנליטיקה. RLS מאפשר רק insert (ל־anon ול־authenticated, עם `user_id` ריק או של המשתמש עצמו). טריגר `events_rate_limit` מדלג בשקט על יותר מ־600 אירועים בשעה לאותו `anon_id`.
- **`purge_old_events()`** – מוחקת אירועים בני יותר מ־180 יום. אם `pg_cron` זמין (Database → Extensions → pg_cron), מתזמנים פעם ביום:
  ```sql
  select cron.schedule('purge-old-events', '17 3 * * *', 'select public.purge_old_events()');
  ```
  בלי `pg_cron` אפשר להריץ ידנית מדי פעם: `select public.purge_old_events();`

**בדיקה ידנית אחרי ההרצה (US-U1 AC7, US-T1 AC6):**
1. שורת `progress` עם `completed.u7l1` → `update progress set data = jsonb_set(data, '{completed}', '{"u1l1":1}') where ...` → `u7l1` עדיין קיים.
2. עם ה־anon key: `insert` ל־`events` מצליח, `select` מחזיר 0 שורות.
3. משתמש אחד לא רואה שורות `srs_state` של משתמש אחר.

**בדיקה אוטומטית מול PostgreSQL מקומי:** `supabase/tests/run.sh` מריץ את `schema.sql` (פעמיים, לבדיקת אידמפוטנטיות), את `analytics-views.sql` ואת `analytics-seed.sql` על מסד ריק, עם תחליף קטן לסכמת `auth` ולתפקידים של Supabase, ואז בודק את שלוש הנקודות שלמעלה, את `merge_srs` ואת כל ה־views (US-T1 AC7). מריצים על מסד ריק שנועד לזה בלבד:

```bash
DATABASE_URL=postgres://postgres@localhost:5432/scratch npm run test:supabase
```

## שיחות וידאו עם AI (Edge Function)

באתר ובאפליקציה אין שרת Express, לכן שיחות הווידאו עם דמות ה־AI רצות דרך Supabase Edge Function בשם `call-turn` ([`supabase/functions/call-turn/index.ts`](../supabase/functions/call-turn/index.ts)). היא מממשת בדיוק את `POST /api/call/turn` ואת `GET /api/call/status` (ראו [api.md](api.md)) עם אותם קבצים משותפים מ־`shared/`. מפתח ה־API נשמר כסוד ב־Supabase ולא מגיע לדפדפן.

**שיחות רק למנויי פרימיום, עד 10 ביום.** הפונקציה דורשת משתמש מחובר: היא מאמתת את ה־access token שלו מול Supabase Auth (`/auth/v1/user`), בודקת שהאימייל ברשימת הסוד `PREMIUM_EMAILS` **או** שיש לו מנוי בתוקף בטבלה `entitlements` (ראו [מנוי בתשלום](#מנוי-בתשלום-billing-webhook) למטה), וסופרת שיחות ותורות בטבלה `call_usage` (לפי היום בשעון ישראל) דרך הפונקציה `increment_call_usage` ב־`schema.sql`. לטבלה ולפונקציה אין שום הרשאה ללקוחות – רק ה־service role (המפתח `SUPABASE_SERVICE_ROLE_KEY` זמין אוטומטית בכל Edge Function, אין צורך להגדיר אותו).

פריסה (פעם אחת, ושוב אחרי כל שינוי ב־`shared/call*.ts`, ב־`shared/premium.ts` או בפונקציה), מתיקיית השורש של ה־repo עם [Supabase CLI](https://supabase.com/docs/guides/cli):

1. **מריצים שוב את `supabase/schema.sql`** ב־SQL Editor (בטוח להריץ שוב). זה יוצר את `call_usage` ואת `increment_call_usage`. בלי זה כל תור מחזיר `502 call_failed`.
2. מגדירים את הסודות ופורסים:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set PREMIUM_EMAILS=first@example.com,second@example.com
# אופציונלי: supabase secrets set CALL_MODEL=claude-haiku-5-5
supabase functions deploy call-turn
supabase functions deploy pet-design   # עיצוב חיה ייחודית עם AI (פרימיום), אותם סודות
```

- **בודקים:** הסוד `TESTER_EMAILS` (באותו פורמט) נותן שיחת ניסיון אחת ביום, עד 10 משפטים, ואחריהם הדמות נפרדת. מי שגם ב־`PREMIUM_EMAILS` או עם מנוי מקבל את המגבלות של פרימיום. הסטטוס מחזיר `tester: true` ו־`callsPerDay: 1`.
- כדי להוסיף או להסיר מנוי מריצים שוב `supabase secrets set PREMIUM_EMAILS=...` עם הרשימה המלאה (אין צורך לפרוס מחדש). לעולם לא כותבים אימיילים בקוד.
- **מה הלקוח שולח:** `POST {SUPABASE_URL}/functions/v1/call-turn` עם גוף `CallTurnRequest` לתור, ו־`GET` לאותה כתובת (בלי גוף) לסטטוס (`CallStatusResponse`). בשתיהן `Authorization: Bearer <access token של המשתמש המחובר>` ו־`apikey: <anon/publishable key>` – `supabase.functions.invoke('call-turn', { method: 'GET' | 'POST', body })` שולח את שניהם לבד כשיש session. בלי session: `401 unauthorized`; משתמש שאינו פרימיום: `403 premium_required` בתור, ו־`premium: false` בסטטוס; מעבר למגבלה: `429 daily_limit`.
- הפונקציה מייבאת את `shared/call.ts`, `shared/call-prompts.ts`, `shared/call-safety.ts` ו־`shared/premium.ts` בנתיב יחסי. הקבצים המשותפים מייבאים `'./call'` בלי סיומת `.ts`, ו־Deno דורש סיומת, לכן [`deno.json`](../supabase/functions/call-turn/deno.json) שליד הפונקציה ממפה את הנתיב הזה ל־`shared/call.ts`. חשוב להריץ את ה־deploy מתוך ה־repo המלא (לא להעתיק רק את תיקיית `supabase/`).
- CORS מותר רק מהאתר (`https://baktanaenglish-hub.github.io`), מהאפליקציה (`https://localhost`) ומ־localhost בפיתוח.
- אימות JWT של ה־gateway נשאר פעיל (פורסים **בלי** `--no-verify-jwt`): הלקוח שולח ב־`Authorization` את ה־access token של המשתמש, שהוא JWT של הפרויקט – גם כשמפתח הפרויקט הוא `sb_publishable_…` (המפתח הולך ב־`apikey`). אם פרסתם בעבר עם `--no-verify-jwt`, פורסים שוב בלעדיו. (רק אם ה־gateway דוחה טוקנים תקינים – למשל בפרויקט שעבר למפתחות חתימה אסימטריים – אפשר לפרוס עם `--no-verify-jwt`; זה עדיין בטוח, כי הפונקציה עצמה מאמתת כל טוקן מול Supabase Auth.)
- הגבלת קצב: 30 בקשות לדקה לכל IP, לכל מופע של הפונקציה, בנוסף למגבלה היומית למשתמש (10 שיחות ו־100 תורות ביום). מגבלת ההוצאה האמיתית מוגדרת ב־Anthropic Console.
- בלי הסוד `ANTHROPIC_API_KEY` הפונקציה מחזירה `503 call_unavailable` והאפליקציה מציגה "שיחות הווידאו לא זמינות כרגע".
- בדיקה מקומית: `supabase functions serve call-turn --env-file .env`.
- הסטטוס (`GET`) מחזיר גם `premiumUntil` ו־`willRenew` כשיש למשתמש מנוי (או היה לו), כדי שהאפליקציה תציג "מתחדש ב־…" / "בתוקף עד …".

## מנוי בתשלום (billing-webhook)

המנוי נמכר באפליקציה מ־Google Play דרך RevenueCat (הרקע וההחלטות: [subscriptions.md](subscriptions.md)). האפליקציה לא מחליטה מי פרימיום: אחרי כל רכישה, חידוש, ביטול, החזר או פקיעה RevenueCat שולחת webhook ל־Edge Function בשם `billing-webhook` ([`supabase/functions/billing-webhook/index.ts`](../supabase/functions/billing-webhook/index.ts)). הפונקציה:

1. בודקת שה־header ‏`Authorization` שווה לסוד `REVENUECAT_WEBHOOK_SECRET` (עם `Bearer ` או בלי). אחרת `401`.
2. מדלגת על אירוע שכבר טופל (טבלה `billing_events`).
3. שואלת את RevenueCat מה המצב העדכני של המשתמש (`GET /v1/subscribers/{id}` עם הסוד `REVENUECAT_API_KEY`) – לא סומכים על סדר האירועים.
4. כותבת לטבלה `entitlements` את `premium_until` (כולל grace period של Google), החנות, המוצר והאם המנוי מתחדש.

`call-turn` קורא את הטבלה: מנוי נחשב בתוקף עד `premium_until` ועוד יום חסד (`PREMIUM_GRACE_MS` ב־`shared/premium.ts`). לשתי הטבלאות אין שום הרשאה ללקוחות.

פריסה ידנית:

```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<מחרוזת אקראית ארוכה> REVENUECAT_API_KEY=sk_...
supabase functions deploy billing-webhook --no-verify-jwt   # RevenueCat לא שולחת JWT של Supabase
```

ב־RevenueCat ← Project settings ← Integrations ← **Webhooks**: ‏URL ‏`https://<project-ref>.supabase.co/functions/v1/billing-webhook`, ובשדה Authorization header את אותו `REVENUECAT_WEBHOOK_SECRET`. "Send test event" צריך להחזיר 200.

- בלי הסודות הפונקציה מחזירה `503`, ו־RevenueCat תנסה שוב מאוחר יותר.
- `PREMIUM_EMAILS` ממשיך לעבוד במקביל – לבעלים, לבודקים ולמתנות.
- שום פרט על הרכישה לא נרשם בלוג מלבד סוג האירוע ומספר המשתמשים שעודכנו.

## עדכון אוטומטי מ־GitHub

ה־workflow ‏`.github/workflows/supabase.yml` מעדכן את Supabase לבד, בכל דחיפה ל־`main` שמשנה את `supabase/` או את הקבצים המשותפים של השיחות. אפשר להריץ אותו גם ידנית מ־**Actions** ← **Supabase** ← **Run workflow**. הוא:

1. מריץ את `supabase/schema.sql` (בטוח להריץ שוב ושוב).
2. מעדכן את מייל איפוס הסיסמה (נושא ותוכן בעברית, מ־`supabase/templates/recovery.html`). שינוי שעושים בלוח הבקרה של Supabase נדרס בהרצה הבאה, ולכן משנים את הקובץ.
3. מעתיק ל־Edge Functions את הסודות `ANTHROPIC_API_KEY`, ‏`PREMIUM_EMAILS`, ‏`TESTER_EMAILS`, ‏`REVENUECAT_WEBHOOK_SECRET` ו־`REVENUECAT_API_KEY`, אם הם מוגדרים ב־GitHub.
4. פורס את כל הפונקציות ב־`supabase/functions` (את `billing-webhook` עם `--no-verify-jwt`), בודק ש־`call-turn` עונה 401 לבקשה בלי משתמש, ושה־`billing-webhook` דוחה בקשה בלי הסוד (401, או 503 כל עוד הסודות לא הוגדרו).

הגדרה, פעם אחת: ב־repo ← **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**:

| Secret | מה שמים |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | טוקן אישי מ־supabase.com ← Account ← **Access Tokens** ← Generate new token |
| `ANTHROPIC_API_KEY` | מפתח API מ־console.anthropic.com |
| `PREMIUM_EMAILS` | האימיילים של משתמשי הפרימיום, מופרדים בפסיקים |
| `TESTER_EMAILS` | האימיילים של הבודקים, מופרדים בפסיקים: שיחת ניסיון אחת ביום, עד 10 משפטים (`TESTER_LIMITS` ב־`shared/call.ts`) |
| `REVENUECAT_WEBHOOK_SECRET` | מחרוזת אקראית ארוכה; אותה מחרוזת בשדה Authorization של ה־webhook ב־RevenueCat |
| `REVENUECAT_API_KEY` | מפתח **Secret** מ־RevenueCat ← Project settings ← API keys (מתחיל ב־`sk_`) |

את מזהה הפרויקט ה־workflow לוקח מהמשתנה `VITE_SUPABASE_URL` שכבר קיים. משתנה אופציונלי: `CALL_MODEL` (בלשונית Variables). למכירת המנוי באפליקציה צריך גם את המשתנה `VITE_REVENUECAT_ANDROID_KEY` (בלשונית Variables) – מפתח ה־**Public** SDK של אפליקציית ה־Play ב־RevenueCat (מתחיל ב־`goog_`). הוא ציבורי ונכנס לאפליקציה; ה־workflow ‏`android.yml` מעביר אותו לבנייה.

## פיתוח מקומי מול Supabase

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co VITE_SUPABASE_ANON_KEY=... npm run dev:web
```

בלי המשתנים האלה האפליקציה המקומית עובדת מול שרת ה־Express שלנו (`npm run dev`), בדיוק כמו קודם.

## איפוס התקדמות של חשבון

"איפוס התקדמות" בפרופיל, כשמחוברים, מאפס גם את החשבון ואת שאר המכשירים: ההתקדמות החדשה נשמרת עם חותמת זמן (`resetAt`), והעותק עם האיפוס החדש מנצח כל מיזוג – כך שמכשיר אחר שעדיין מחזיק את ההתקדמות הישנה מאמץ את האיפוס במקום להחזיר אותה. גם מצב החזרה החכמה נמחק מהשרת.
דרוש עדכון של `schema.sql` (הרצה חוזרת ב־SQL Editor): הטריגר `keep_completed_lessons` מכבד עכשיו איפוס. XP של הליגה השבועית לא נמחק.
