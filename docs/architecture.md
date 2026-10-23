# ארכיטקטורה

## תמונה כללית

```
┌──────────────────────────── דפדפן ────────────────────────────┐
│  React 19 SPA (src/)                                          │
│   components/  ← UI בעברית, RTL                               │
│   lib/progress.ts  ← כללי משחק טהורים (לבבות, XP, רצף, פתיחה) │
│   lib/exercises.ts ← יצירת תרגילים מ־data/course.ts           │
│   lib/store.ts     ← localStorage  (baktana-english:progress:v1)│
│   lib/speech.ts    ← Web Speech API (הקראה באנגלית)            │
└───────────────┬───────────────────────────────────────────────┘
                │  fetch('/api/...')  JSON + Bearer token   (אופציונלי)
                ▼
┌──────────────────────── server/ (Node 22) ────────────────────┐
│  Express + tsx, PORT=3001                                     │
│   auth (hash סיסמאות + טוקן), progress, lessons, leaderboard  │
│   SQLite דרך node:sqlite (בלי תלויות native)                 │
│   מייבא: ../src/lib/progress.ts, ../src/data/course.ts,       │
│          ../shared/api.ts                                     │
└───────────────────────────────────────────────────────────────┘

shared/api.ts  ← החוזה: טיפוסי בקשה/תשובה שמשותפים לשני הצדדים
```

## שלוש השכבות

| שכבה | תיקייה | אחריות |
|---|---|---|
| **Web** | `src/` | כל חוויית הלימוד. עובדת לגמרי לבד (מצב אורח). קוראת לשרת רק להרשמה, סנכרון ולוח מובילים |
| **Shared** | `shared/` + המודולים הטהורים ב־`src/lib` ו־`src/data` | חוזה ה־HTTP, הטיפוס `Progress`, כללי המשחק ותוכן הקורס – **קוד אחד לשני הצדדים**, כך שהשרת מחשב XP/רצף בדיוק כמו הלקוח ומאמת `lessonId` מול אותו קורס |
| **Server** | `server/` | זהות משתמשים, שמירת התקדמות, מיזוג, אירועי השלמה ולוח מובילים שבועי |

**כלל זהב:** המודולים הטהורים (`progress.ts`, `answer.ts`, `exercises.ts`, `course.ts`) לא תלויים ב־DOM או ב־React, ומשתנים רק בתוספות (exports חדשים) – השרת תלוי בחתימות שלהם.

## מודל נתונים (שרת)

| טבלה | עמודות עיקריות |
|---|---|
| `users` | `id`, `email` (ייחודי, באותיות קטנות), `password_hash`, `display_name`, `created_at` |
| `progress` | `user_id` (PK), `data` (JSON של `Progress`), `updated_at` |
| `lesson_completions` | `id`, `user_id`, `lesson_id`, `xp`, `accuracy`, `completed_at` – מקור הנתונים ללוח המובילים (סכום `xp` ב־7 ימים) |
| `sessions` / טוקנים | לפי בחירת השרת (טוקן חתום או טבלת סשנים) |

> הסכמה המדויקת בבעלות סוכן ה־backend; זהו התיאור הלוגי.

## זרימת נתונים

### 1. אורח (ברירת מחדל)
```
UI → update(fn) → Progress חדש → localStorage
           ↑ refresh() כל דקה (מילוי לבבות, איפוס xpToday ביום חדש)
```
אין שום בקשת רשת. התוכן מגיע בתוך חבילת ה־JS.

### 2. הרשמה / התחברות
```
register|login → { token, user }
   → שמירת token בדפדפן
   → PUT /api/progress  (ההתקדמות המקומית)
   → השרת ממזג (max xp, איחוד completed, lastActiveDate המאוחר + streak שלו)
   → הלקוח מחליף את המקומי בתוצאה
```

### 3. סיום שיעור כמשתמש מחובר – Offline-first
```
1. completeLesson() מקומית   ← מיידי, הממשק לא מחכה לרשת
2. POST /api/lessons/:id/complete { xp, accuracy }
     ✓ הצליח  → מיזוג התשובה עם המקומי
     ✗ נכשל   → מסמנים "יש שינויים לא מסונכרנים"
3. בטעינה הבאה / כשחוזרת הרשת (אירוע online)
     → PUT /api/progress עם המקומי → מיזוג
```
בגלל שהמיזוג מונוטוני (מקסימום ואיחוד) ואידמפוטנטי, אפשר לשלוח שוב בלי חשש לכפילויות ב־`Progress`. (אירוע השלמה שנכשל לא ייכנס ללוח המובילים השבועי – מגבלה ידועה, ראו roadmap.)

### 4. שחזור סשן
```
טעינה עם token → GET /api/me
   200 → מיזוג progress מהשרת עם המקומי (PUT אם המקומי מכיל משהו חדש)
   401 → מחיקת token, המשך כאורח עם ההתקדמות המקומית
   שגיאת רשת → המשך עם המקומי, ניסיון חוזר מאוחר יותר
```

### אזורי זמן
הרצף ו־`xpToday` מחושבים לפי **תאריך מקומי**. הלקוח שולח עם כל השלמת שיעור את התאריך המקומי שלו (`date`), והשרת מפעיל את `completeLesson` עם התאריך הזה (אם הוא במרחק יום לכל היותר מהתאריך בשרת). `TZ` של השרת משמש רק כברירת מחדל כשהתאריך חסר או לא סביר.

## אבטחה
- סיסמאות: hash עם salt (למשל `crypto.scrypt` המובנה ב־Node) – אף פעם לא בטקסט גלוי.
- טוקן: אקראי/חתום, נשלח רק ב־`Authorization`. אין cookies → אין CSRF.
- אימות קלט בכל נקודת קצה; `lessonId` נבדק מול `course.ts`; `xp` מוגבל ל־0–15.
- לוח המובילים חושף רק `displayName`.
- הגבלת קצב (rate limit) בהתחברות – מומלץ.

## פיתוח והרצה

```bash
# ממשק
npm install
npm run dev            # Vite על 5173, /api → localhost:3001

# שרת (בתיקייה server/)
cd server && npm install
npm run dev            # tsx, PORT=3001

npm test               # בדיקות
npm run build          # tsc -b && vite build → dist/
```
הפקודות המדויקות של השרת – בקובץ ה־handoff של התשתית/ה־backend (`docs/handoff/`).

## פריסה (Deployment)

אפשרות מומלצת – **תהליך Node אחד**:
1. `npm run build` מייצר `dist/` סטטי.
2. השרת מגיש את `dist/` כקבצים סטטיים ואת `/api/*` מאותו origin (אין צורך ב־CORS).
3. קובץ ה־SQLite על דיסק קבוע (volume), עם גיבוי יומי.
4. משתני סביבה: `PORT`, נתיב ה־DB, סוד לחתימת טוקנים.

חלופה: הממשק על CDN סטטי (Netlify/Vercel/GitHub Pages) והשרת בנפרד – אז צריך CORS ו־URL בסיס ל־API. במקרה כזה, גם בלי שרת בכלל, האתר הסטטי עובד במצב אורח.
