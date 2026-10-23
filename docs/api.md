# תיעוד ה־API

מקור האמת הוא הקובץ [`shared/api.ts`](../shared/api.ts) – הטיפוסים שם משותפים לאפליקציה (`src/`) ולשרת (`server/`). מסמך זה מסביר אותם בשפה אנושית, עם דוגמאות. אם יש סתירה – `shared/api.ts` קובע.

## כללי

| נושא | ערך |
|---|---|
| בסיס | כל הנתיבים תחת `/api`. בפיתוח Vite מעביר (proxy) את `/api` אל `http://localhost:3001` |
| פורמט | JSON בלבד (`Content-Type: application/json`) |
| אימות | `Authorization: Bearer <token>` בנקודות הקצה המסומנות 🔒. הטוקן מתקבל מהרשמה/התחברות |
| שגיאות | סטטוס שאינו 2xx, וגוף מסוג `ApiError` |
| תאריכים | `createdAt` – מחרוזת ISO-8601; `lastActiveDate` – `YYYY-MM-DD` לפי השעון המקומי של הלומד |
| חותמות זמן | `heartsUpdatedAt` – מילישניות מאז epoch |

### אובייקט שגיאה – `ApiError`

```json
{ "error": "email_taken", "message": "כתובת האימייל כבר רשומה" }
```

- `error` – קוד קצר באנגלית, לשימוש בקוד.
- `message` – הודעה **בעברית** שאפשר להציג ללומד כמו שהיא.

### קודי סטטוס וקודי שגיאה

החוזה מגדיר את מבנה השגיאה אך לא רשימה סגורה של קודים. אלה הקודים שהשרת ב־`server/` מחזיר בפועל (הלקוח צריך להסתמך על הסטטוס ועל `message`):

| סטטוס | `error` | מתי |
|---|---|---|
| 400 | `invalid_email`, `weak_password`, `invalid_password`, `invalid_display_name` | הרשמה: אימייל לא תקין, סיסמה קצרה מ־8 תווים (או ארוכה מ־200), שם תצוגה שאינו 2–30 תווים |
| 400 | `missing_credentials` | התחברות בלי אימייל או סיסמה |
| 400 | `missing_password` | מחיקת חשבון בלי סיסמה |
| 400 | `invalid_progress` | גוף `PUT /api/progress` שאינו `Progress` תקין |
| 400 | `invalid_xp`, `invalid_accuracy` | `xp` שאינו מספר, או `accuracy` מחוץ ל־0–100 |
| 401 | `unauthorized` | אין טוקן, טוקן לא תקין או פג תוקף |
| 401 | `invalid_credentials` | אימייל או סיסמה שגויים בהתחברות (הודעה אחת לשני המקרים), או סיסמה שגויה במחיקת חשבון |
| 403 | `lesson_locked` | השלמת שיעור שעדיין נעול לפי ההתקדמות השמורה בשרת |
| 403 | `premium_required` | שיחת וידאו: המשתמש המחובר אינו מנוי פרימיום (האימייל שלו לא ב־`PREMIUM_EMAILS`) |
| 404 | `not_found` | נתיב API לא קיים |
| 404 | `lesson_not_found` | `lessonId` שאינו בקורס |
| 409 | `email_taken` | הרשמה עם אימייל שכבר קיים (ללא תלות ברישיות) |
| 429 | `rate_limited` | יותר מ־20 ניסיונות הרשמה/התחברות ב־15 דקות מאותה כתובת IP |
| 400 | `invalid_call` | גוף `POST /api/call/turn` לא תקין (דמות לא מוכרת, הודעה ריקה או ארוכה מ־400 תווים) |
| 429 | `daily_limit` | שיחת וידאו: הגעתם ל־10 שיחות ביום (`callsPerDay`) או ל־100 תורות ביום (`turnsPerDay`) |
| 502 | `call_failed` | שיחת וידאו: תקלה או timeout מול שירות ה־AI |
| 503 | `call_unavailable` | שיחת וידאו: `ANTHROPIC_API_KEY` לא מוגדר בשרת |
| 500 | `server_error` | תקלה פנימית |

---

## אובייקטים

### `User`
```json
{ "id": "u_7f3c", "email": "dana@example.com", "displayName": "דנה", "createdAt": "2026-10-18T09:12:00.000Z" }
```

### `Progress`
מוגדר ב־`src/lib/progress.ts` (אותו טיפוס בדפדפן ובשרת).

| שדה | טיפוס | משמעות |
|---|---|---|
| `xp` | number | סה״כ נקודות |
| `completed` | `Record<lessonId, number>` | כמה פעמים כל שיעור הושלם |
| `streak` | number | רצף ימים (כפי שנשמר; התצוגה מאפסת אם דילגו על יום) |
| `lastActiveDate` | string \| null | תאריך מקומי של השיעור האחרון |
| `xpToday` | number | XP שנצבר ביום `lastActiveDate` |
| `hearts` | number | 0–5 |
| `heartsUpdatedAt` | number | ממנו נספר שעון מילוי הלבבות (לב כל 30 דקות) |

```json
{
  "xp": 45,
  "completed": { "u1l1": 2, "u1l2": 1 },
  "streak": 3,
  "lastActiveDate": "2026-10-18",
  "xpToday": 15,
  "hearts": 4,
  "heartsUpdatedAt": 1792310400000
}
```

---

## נקודות קצה

### `GET /api/health`
בדיקת חיים. ללא אימות.

```http
GET /api/health
```
```json
200 { "ok": true, "version": "0.2.0" }
```

### `POST /api/auth/register`
יצירת חשבון. מחזיר טוקן – המשתמש מחובר מיד.

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "dana@example.com", "password": "secret123", "displayName": "דנה" }
```
```json
201 { "token": "eyJhbGciOi...", "user": { "id": "u_7f3c", "email": "dana@example.com", "displayName": "דנה", "createdAt": "2026-10-18T09:12:00.000Z" } }
```
שגיאות: `400` (שדה חסר/לא תקין, סיסמה < 8), `409 email_taken`.

### `POST /api/auth/login`
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "dana@example.com", "password": "secret123" }
```
```json
200 { "token": "eyJhbGciOi...", "user": { "id": "u_7f3c", "email": "dana@example.com", "displayName": "דנה", "createdAt": "2026-10-18T09:12:00.000Z" } }
```
שגיאות: `400`, `401 invalid_credentials`.

### `GET /api/me` 🔒
המשתמש המחובר וההתקדמות שלו – משמש לשחזור סשן אחרי רענון.

```http
GET /api/me
Authorization: Bearer eyJhbGciOi...
```
```json
200 { "user": { "id": "u_7f3c", "email": "dana@example.com", "displayName": "דנה", "createdAt": "..." }, "progress": { "xp": 45, "completed": { "u1l1": 2 }, "streak": 3, "lastActiveDate": "2026-10-18", "xpToday": 15, "hearts": 4, "heartsUpdatedAt": 1792310400000 } }
```
שגיאות: `401`.

### `DELETE /api/me` 🔒
מוחק את החשבון לצמיתות, ואיתו ההתקדמות, ה־XP של הליגה, מצב החזרה ואירועי האנליטיקה שמקושרים אליו (`ON DELETE CASCADE`). חנויות האפליקציות מחייבות את זה (ראו [store-release.md](store-release.md)). הסיסמה נבדקת שוב, כדי שמכשיר מחובר שהושאל לא יוכל למחוק חשבון. מוגבל באותו rate limit כמו ההתחברות.

```http
DELETE /api/me
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "password": "secret123" }
```
```
204 (בלי גוף)
```
שגיאות: `400 missing_password`, `401 invalid_credentials` (סיסמה שגויה), `401 unauthorized`, `429`.
בגרסת Supabase הלקוח מתחבר מחדש עם הסיסמה ואז קורא לפונקציה `delete_my_account()` (ב־`supabase/schema.sql`).

### `GET /api/progress` 🔒
```json
200 { "progress": { ... } }
```

### `PUT /api/progress` 🔒
מעלה התקדמות מקומית (למשל אורח שנרשם, או סנכרון אחרי עבודה אופליין). **השרת ממזג** ולא דורס:

| שדה | כלל מיזוג |
|---|---|
| `xp` | המקסימום מבין השרת והלקוח |
| `completed` | איחוד המפתחות; לכל שיעור – המונה הגבוה |
| `lastActiveDate` + `streak` | לוקחים את התאריך המאוחר יותר, יחד עם ה־streak שלו (בתאריך זהה – ה־streak הגבוה) |
| `xpToday` | מגיע יחד עם ה־`lastActiveDate` שנבחר (בתאריך זהה – הגבוה) |
| `hearts`, `heartsUpdatedAt` | אחרי החלת מילוי הלבבות בשני הצדדים, נשמר המספר **הנמוך** עם השעון שלו (סנכרון לא ממלא לבבות) |
| `dailyGoal` | שדה מקומי של הלקוח; מתקבל ולא נשמר בשרת |

עלייה ב־`xp` שנובעת מהמיזוג (תרגול, שיעורים שהושלמו אופליין) נרשמת גם ל־XP השבועי של הליגה, עד 50 XP לכל סנכרון.

המיזוג אידמפוטנטי: שליחה חוזרת של אותה התקדמות לא משנה את התוצאה.

```http
PUT /api/progress
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "xp": 30, "completed": { "u1l1": 1, "u1l3": 1 }, "streak": 1, "lastActiveDate": "2026-10-18", "xpToday": 30, "hearts": 5, "heartsUpdatedAt": 1792310400000 }
```
```json
200 { "progress": { "xp": 45, "completed": { "u1l1": 2, "u1l2": 1, "u1l3": 1 }, "streak": 3, "lastActiveDate": "2026-10-18", ... } }
```
שגיאות: `400` (גוף שאינו `Progress` תקין), `401`.

> **v2 – מזהי שיעורים לא מוכרים:** מפתח ב־`completed` נשמר אם הוא שיעור בקורס **או** שהוא נראה כמו מזהה שיעור של גרסה חדשה יותר (`^u\d{1,2}(l\d{1,2}|cp)$`, למשל `u13l1`, `u12cp`), עד 500 מפתחות (שיעורים מוכרים קודם). `__practice__` ומפתחות אחרים נזרקים. כך שרת או לקוח ישן לא מוחקים שיעורים שנוספו בגרסה חדשה.

### `POST /api/lessons/:lessonId/complete` 🔒
רישום השלמת שיעור. השרת מפעיל את אותו כלל `completeLesson` מ־`src/lib/progress.ts` (XP, רצף, מונה) ושומר את האירוע לצורך לוח המובילים.

```http
POST /api/lessons/u1l3/complete
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "xp": 15, "accuracy": 100, "date": "2026-10-18" }
```
```json
200 { "progress": { "xp": 60, "completed": { "u1l1": 2, "u1l2": 1, "u1l3": 1 }, ... } }
```
**כלל הפתיחה (v2):** שיעור פתוח אם הוא הראשון בקורס, אם הוא הושלם, אם השיעור שלפניו הושלם, **או** אם שיעור כלשהו אחריו הושלם (high-water mark). כך שיעור שנוסף מאחורי הנקודה של הלומד (למשל `u1l4` אצל מי שסיים את `u2l1`) פתוח ולא מחזיר 403.

`xp` מעוגל ונחתך לטווח 0–50 (הלקוח שולח 10–15). שגיאות: `400` (`xp` שאינו מספר, או `accuracy` מחוץ ל־0–100), `401`, `403 lesson_locked`, `404 lesson_not_found`.

`date` (אופציונלי) – התאריך המקומי של הלומד (`YYYY-MM-DD`) בסיום השיעור. השרת משתמש בו לחישוב `lastActiveDate`, הרצף ו־`xpToday`, כך שהרצף נספר לפי לוח השנה של המכשיר ולא לפי אזור הזמן של השרת. תאריך שאינו תקין או רחוק יותר מיום אחד מהתאריך בשרת – מתעלמים ממנו ומשתמשים בתאריך השרת.

> הערה: ב־`PUT /api/progress` השרת מתעלם מנתוני היום (`lastActiveDate`, `streak`, `xpToday`) אם `lastActiveDate` מאוחר ביותר מיום אחד מהתאריך בשרת (שעון מכשיר שגוי), כדי שתאריך עתידי לא "ינצח" בכל מיזוג ויקפיא את הרצף.

### `GET /api/leaderboard`
הלומדים המובילים לפי XP. **אימות אופציונלי** – עם טוקן, השורה של המשתמש מסומנת `isMe: true`.

```http
GET /api/leaderboard?period=week
Authorization: Bearer eyJhbGciOi...   (אופציונלי)
```
```json
200 {
  "entries": [
    { "rank": 1, "displayName": "יוסי", "weeklyXp": 210, "isMe": false },
    { "rank": 2, "displayName": "דנה", "weeklyXp": 145, "isMe": true },
    { "rank": 3, "displayName": "Noa", "weeklyXp": 90, "isMe": false }
  ],
  "endsAt": 1761944400000
}
```
- `period`: `week` (השבוע הקלנדרי, מיום ראשון), `month` (החודש הקלנדרי) או `all` (מצטבר). התקופות לפי שעון ישראל (`shared/groups.ts` → `periodRange`). ערך אחר → `400 invalid_period`.
- **בלי `period`** (לקוחות ישנים): שבעת הימים האחרונים, בלי `endsAt` – כמו קודם.
- `weeklyXp` הוא ה־XP בתקופה שנבחרה (השם נשאר מהליגה השבועית). `endsAt` – סוף התקופה (ms), `null` במצטבר.
- עשרים המובילים; אם המשתמש מתחת להם, השורה שלו מתווספת בסוף עם המקום האמיתי שלו.
- מוצג רק שם תצוגה – אף פעם לא אימייל או מזהה.

### קבוצות ואתגרים קבוצתיים
הכללים המלאים ב־[groups.md](groups.md). כל הנתיבים מחזירים שגיאות עם קוד מ־`GROUP_ERRORS` (`shared/groups.ts`): `invalid_name`/`invalid_code`/`invalid_period` (400), `group_not_found`/`not_member` (404), `group_full`/`too_many_groups`/`already_member` (409).

#### `GET /api/groups` 🔒
```json
200 {
  "groups": [{
    "id": "…", "name": "המשפחה", "inviteCode": "C8T734", "memberCount": 2, "isOwner": true, "joinedAt": 1761000000000,
    "weekStart": 1760734800000, "weekEnd": 1761339600000, "weekXp": 45, "weekScore": 15, "weekRank": 2,
    "challenges": [
      { "id": "xp:1760734800000", "kind": "xp", "icon": "⚡", "title": "צברו יחד 240 XP", "goal": 240, "gems": 20, "progress": 45, "done": false }
    ]
  }]
}
```
- `weekScore` = ממוצע XP לחבר (קבוצה קטנה מ־3 נספרת כ־3). `weekRank` – המקום בדירוג הקבוצות השבועי, `null` לפני XP ראשון.
- `challenges` – שלושת אתגרי השבוע: `xp`, `lessons` (שיעורים שהושלמו), `days` (ימי לימוד של חברים).

#### `POST /api/groups` 🔒
`{ "name": "המשפחה" }` → `201 { "group": GroupSummary }`. השם 2–30 תווים (רווחים מצטמצמים). עד 5 קבוצות למשתמש.

#### `POST /api/groups/join` 🔒
`{ "code": "c8t-734" }` → `200 { "group": GroupSummary }`. הקוד בכל גודל אותיות, רווחים ומקפים לא משנים. עד 30 חברים בקבוצה.

#### `GET /api/groups/:id/members?period=week|month|all` 🔒
חברי הקבוצה בלבד. `200 { "members": [{ "rank": 1, "displayName": "דנה", "xp": 40, "isMe": true, "isOwner": true }] }`. ה־XP של כל חבר נספר מרגע ההצטרפות שלו.
- `pet` (אופציונלי): החיה של החבר, אם יש לו – `{ "name": "שלהבת", "emoji": "🐲", "stage": 2, "color": "#4caf50", "worn": ["🧢"] }` (`PetBadge`, [pets.md](spec/pets.md)). חבר בלי חיה – בלי השדה.

#### ראש בראש – `GET/POST /api/duels`, `POST /api/duels/join`, `DELETE /api/duels/:id` 🔒
תחרות XP של 7 ימים בין שני חברים (`shared/duels.ts`, [groups.md](groups.md)).
- `GET /api/duels` → `200 { "duels": DuelSummary[] }`: הזמנות פתוחות, תחרויות שרצות ותחרויות שהסתיימו בשבועיים האחרונים, מהחדשה לישנה.
- `POST /api/duels` (בלי גוף) → `201 { "duel": DuelSummary }` עם `inviteCode`. `POST /api/duels/join` `{ "code": "ABC234" }` → `200 { "duel" }`, והתחרות מתחילה.
- `DELETE /api/duels/:id` → `204`: ביטול הזמנה שעוד לא התקבלה (רק מי שפתח אותה).
```json
{ "id": "…", "inviteCode": "ABC234", "isChallenger": true, "state": "active", "createdAt": 1761000000000,
  "startsAt": 1761000600000, "endsAt": 1761605400000, "result": null,
  "me": { "displayName": "דנה", "xp": 40, "pet": { "name": "שלהבת", "emoji": "🐲", "stage": 2, "color": "#4caf50", "worn": [] } },
  "opponent": { "displayName": "יוסי", "xp": 25, "pet": null } }
```
- `state`: `waiting` (אין עדיין יריב; `endsAt` הוא מועד פקיעת ההזמנה) | `active` | `finished`, ואז `result` הוא `won` | `lost` | `tie` מצד הלומד.
- שגיאות: `400 invalid_code`, `404 duel_not_found` (אין הזמנה פתוחה עם הקוד, היא כבר התקבלה או פגה), `409 own_duel`, `409 too_many_duels` (עד 3 פתוחות), `404 not_in_duel`.
- ב־Supabase: הטבלה `duels` והפונקציות `create_duel`, `join_duel`, `cancel_duel`, `my_duels`.

#### `PUT /api/me/pet` 🔒
שיתוף החיה האישית עם הקבוצות: `{ "pet": PetBadge }`, או `{ "pet": null }` כדי להפסיק → `204`. התג נבדק ב־`parsePetBadge` (מראה ואביזרים מתוך הרשימות המוכרות, שלב 0–4, שם עד 16 תווים). תג לא תקין → `400 invalid_pet`. ב־Supabase: העמודה `profiles.pet` (הלומד מעדכן את הפרופיל שלו), והפונקציה `group_member_stats` מחזירה אותה.

#### `DELETE /api/groups/:id/membership` 🔒
עזיבת הקבוצה → `204`. אם המייסד עוזב, הקבוצה עוברת לחבר הוותיק ביותר; קבוצה ריקה נמחקת.

#### `GET /api/groups/leaderboard?period=week|month|all`
**אימות אופציונלי** – עם טוקן, הקבוצות של המשתמש מסומנות `isMine: true`.
```json
200 {
  "entries": [{ "rank": 1, "name": "הכיתה", "memberCount": 10, "totalXp": 600, "score": 60, "isMine": false }],
  "endsAt": 1761339600000,
  "previousWinners": [{ "rank": 1, "name": "המשפחה", "memberCount": 2, "totalXp": 300, "score": 100, "isMine": true }]
}
```
- ממוין לפי `score` (ממוצע לחבר), אחר כך `totalXp`. רק קבוצות עם XP בתקופה. עשרים המובילות + הקבוצות שלי מתחתן.
- `previousWinners` – שלוש המובילות בשבוע/בחודש הקודם (ריק במצטבר).

### `GET /api/srs` 🔒 (v2)
מצב החזרה המרווחת המלא של הלומד (`ItemStates`: מפתח פריט → מצב). מפתחות: `w:<wordId>` למילה, `s:<lessonId>:<index>` למשפט (`shared/item-keys.ts`).

```json
200 { "items": { "w:water": { "box": 2, "due": "2026-10-20", "seen": 3, "wrong": 1, "last": 1792310400000 } } }
```
שגיאות: `401`.

### `PUT /api/srs` 🔒 (v2)
מעלה **דלתא** – רק הפריטים שהשתנו (עד 1000). השרת:
1. מסנן פריטים לא תקינים (`sanitizeItemStates`): מפתח לא תקין, `box` מחוץ ל־0–5, תאריך לא אמיתי או יותר מ־400 יום קדימה, מספר שלילי או לא שלם. `last` עתידי יורד לשעת השרת. פריט פסול מושמט – השאר נשמרים.
2. ממזג לכל פריט (`shared/srs-merge.ts`): ה־`last` החדש יותר קובע `box`/`due`/`last`; ב־`last` שווה – הקופסה הנמוכה; `seen`/`wrong` – המקסימום.
3. שומר בטרנזקציה אחת ומחזיר את **המצב המלא** הממוזג.

תקרה: 3000 פריטים ללומד. פריטים חדשים מעבר לה לא נשמרים (לפי סדר המפתחות).

```http
PUT /api/srs
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "items": { "w:water": { "box": 1, "due": "2026-10-18", "seen": 4, "wrong": 2, "last": 1792320000000 } } }
```
```json
200 { "items": { "w:water": { "box": 1, ... }, "s:u3l1:0": { ... } } }
```
שגיאות: `400 invalid_srs` (גוף שאינו `{ items: {...} }`), `401`, `413 too_many_items` (יותר מ־1000 פריטים בבקשה).

### `POST /api/events` (v2)
אירועי אנליטיקה אנונימיים (`shared/analytics.ts`, docs/spec/v2.md §8). **אימות אופציונלי:** עם טוקן תקין `user_id` נלקח ממנו – אף פעם לא מהגוף. טוקן לא תקין = אורח.

```http
POST /api/events
Content-Type: application/json

{ "events": [ { "name": "lesson_complete", "anonId": "3f2b8c1e-7d4a-4c2b-9e1f-0a1b2c3d4e5f", "ts": 1792310400000,
  "localDate": "2026-10-18", "localHour": 9, "appVersion": "0.2.0", "platform": "web",
  "lessonId": "u1l1", "durationMs": 61000, "props": { "accuracy": 90 } } ] }
```
`204` בלי גוף.
- עד 50 אירועים בבקשה (השאר נזרקים).
- אירוע עם שם לא מוכר, `anonId` שאינו UUID, תאריך/שעה לא תקינים, `props` מעל 1KB או שדה מחוץ למגבלות העמודות – נזרק. אם לא נשאר אף אירוע תקין: `400 invalid_events`.
- הגבלת קצב: 60 בקשות לדקה לכל IP (`429 rate_limited`).

### שיחת וידאו עם AI – גישה ומגבלות
שיחות הווידאו (`shared/call.ts`) זמינות רק ל**משתמשים מחוברים שהם מנויי פרימיום**. כרגע פרימיום = האימייל של החשבון מופיע במשתנה הסביבה `PREMIUM_EMAILS` בשרת (רשימה מופרדת בפסיקים, בלי תלות ברישיות ורווחים; `shared/premium.ts`). מנויים דרך חנויות האפליקציות יגיעו בהמשך.

- **מגבלה יומית:** עד 10 שיחות (`CALL_LIMITS.callsPerDay`) ועד 400 תורות של הלומד (`CALL_LIMITS.turnsPerDay`) ביום, לפי התאריך המקומי של השרת (`TZ`, ברירת מחדל `Asia/Jerusalem`).
- **מה נחשב שיחה חדשה:** תור שב־`history` שלו אין אף הודעה של הלומד (`role: "user"`) – כלומר התור הראשון אחרי הברכה. תורות המשך באותה שיחה נספרים כתורות בלבד, ולכן שיחה שכבר התחילה יכולה להימשך גם אחרי שהגעתם ל־10.
- **מתי נספר:** אחרי שהבקשה עברה אימות (משתמש פרימיום, גוף תקין, השירות מוגדר) ולפני הקריאה למודל. נספרים גם תורות שסומנו (`flagged`) ותור הפרידה. בקשות שנדחו (`400`, `401`, `403`, `429`, `503`) לא נספרות; תור שהמודל נכשל בו (`502`) נשאר ספור.
- השרת שומר רק מונים יומיים (`call_usage`: משתמש, יום, מספר שיחות, מספר תורות) – לא את תוכן השיחה. מחיקת חשבון (`DELETE /api/me`) מוחקת גם אותם.

### `GET /api/call/status` 🔒
האם הלומד יכול להתקשר, וכמה שיחות כבר התחיל היום (`CallStatusResponse`).
```json
200 { "premium": true, "callsToday": 3, "callsPerDay": 10 }
```
- משתמש שאינו פרימיום מקבל `200` עם `"premium": false` (לא 403), כדי שהאפליקציה תציג הסבר במקום כפתור שיחה.
- שגיאות: `401 unauthorized`.

### `POST /api/call/turn` 🔒 (פרימיום)
תור אחד בשיחת "וידאו" באנגלית עם דמות AI. הלומד אמר משהו – השרת מחזיר את תשובת הדמות. השרת לא שומר ולא מתעד את תוכן השיחה.

```http
POST /api/call/turn
Authorization: Bearer <token>
Content-Type: application/json

{ "persona": "teacher",
  "history": [ { "role": "assistant", "text": "Hi! I'm Emma, your English teacher. How are you today?" } ],
  "message": "I goed to school today" }
```
```json
200 { "reply": "Oh, you went to school! What did you learn?", "replyHe": "הו, הלכת לבית הספר! מה למדת?",
      "corrections": [ { "original": "I goed", "corrected": "I went", "explanationHe": "went הוא העבר של go" } ],
      "callsToday": 1 }
```
- `persona`: `teacher` | `friend` | `barista` | `interviewer`. רק `teacher` מחזיר `corrections`; אצל השאר זה תמיד `[]`.
- `history`: השיחה עד עכשיו (כולל הברכה הראשונה), מהישן לחדש, **בלי** `message`. השרת שומר רק את 20 השורות האחרונות.
- `message`: עד 400 תווים.
- `callsToday`: מספר השיחות שהתחילו היום, כולל זו, אחרי התור הזה.
- הודעה עם פרטים אישיים, תוכן לא הולם או מצוקה – המודל לא נקרא, ומוחזרת תשובה בטוחה עם `flagged` (`personal_info` | `inappropriate` | `self_harm`). גם תשובת מודל לא הולמת מוחלפת בתשובה בטוחה.
- אחרי 40 תורות של הלומד ב־`history` מוחזרת פרידה עם `"ended": true`, בלי קריאה למודל.
- המודל: Claude דרך ה־Messages API (`ANTHROPIC_API_KEY`, ובאופן אופציונלי `CALL_MODEL`, ברירת מחדל `claude-haiku-5-5`). timeout של 20 שניות.
- שגיאות: `401 unauthorized` (לא מחובר), `403 premium_required` ("שיחות וידאו זמינות כרגע רק למנויי פרימיום"), `429 daily_limit` ("הגעתם למגבלה של 10 שיחות ביום. נתראה מחר!", או הודעה על מגבלת התורות), `400 invalid_call`, `429 rate_limited` (יותר מ־30 בקשות לדקה לכל IP), `502 call_failed`, `503 call_unavailable`.
- באתר ב־GitHub Pages ובאפליקציה (בלי שרת Express) אותה לוגיקה רצה כ־Supabase Edge Function בשם `call-turn` (`POST` לתור, `GET` לסטטוס, עם ה־access token של Supabase) – ראו [supabase.md](supabase.md).

### `POST /api/pet/design` 🔒 (פרימיום)
עיצוב חיה אישית ייחודית עם AI ([pets.md](spec/pets.md)). הלומד מתאר במילים את החיה שהוא רוצה – השרת מחזיר עיצוב מתוך אבני הבניין שב־`shared/pet-design.ts`. התיאור לא נשמר ולא מתועד.

```http
POST /api/pet/design
Authorization: Bearer <token>
Content-Type: application/json

{ "prompt": "דרקון סגול קטן שאוהב מוזיקה", "current": { "name": "זוהר", "base": "🐲", "color": "lilac", "traits": [], "personality": "funny", "bio": "" } }
```
```json
200 { "name": "זוהר", "base": "🐲", "color": "lilac", "traits": ["music", "sparkles"], "personality": "funny",
      "bio": "דרקון קטן שמזמזם שירים באנגלית" }
```
- `prompt`: עד 300 תווים. `current` (אופציונלי): העיצוב הקיים, כדי לשנות רק את מה שביקשו.
- התשובה תמיד עוברת `parsePetDesign`: `base` מתוך `PET_BASES`, `color` מתוך `PET_COLORS`, עד 3 `traits`, `personality` אחת מ־`cheerful` | `calm` | `funny` | `brave`, שם עד 16 תווים ותיאור עד 140.
- פרימיום לפי `PREMIUM_EMAILS` (ב־Supabase גם מנוי בתוקף). עד 10 עיצובים ביום ללומד (נספר בזיכרון השרת).
- שגיאות: `401 unauthorized`, `403 premium_required`, `400 invalid_design` (תיאור ריק או לא הולם), `429 daily_limit`, `429 rate_limited`, `502 design_failed`, `503 design_unavailable` (אין `ANTHROPIC_API_KEY`).
- ב־Supabase: Edge Function בשם `pet-design` (`POST`), ראו [supabase.md](supabase.md).

---

## דוגמה: זרימת אורח → משתמש רשום

```
1. אורח לומד → Progress נשמר ב־localStorage
2. POST /api/auth/register            → { token, user }
3. PUT  /api/progress (Progress מקומי) → { progress: ממוזג }
4. הלקוח מחליף את המקומי בממוזג ושומר את הטוקן
5. בכל סיום שיעור: completeLesson מקומית + POST /api/lessons/:id/complete
6. ברענון: GET /api/me → מיזוג עם המקומי (PUT אם המקומי חדש יותר)
```
