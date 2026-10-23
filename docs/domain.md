# דומיין משלנו: baktanaenglish.co.il

האתר מתארח ב־GitHub Pages, וכרגע כתובתו `https://baktanaenglish-hub.github.io/baktana-english/`. כדי להעביר אותו לכתובת `https://baktanaenglish.co.il` עושים את השלבים האלה **לפי הסדר**. הקוד כבר מוכן: הבנייה של האתר מזהה את הדומיין לבד, ואפליקציית האנדרואיד עוברת אליו כשמגדירים משתנה אחד (שלב 4).

עד שכל השלבים מסתיימים, האתר ממשיך לעבוד בכתובת הישנה. אחרי המעבר הכתובת הישנה מפנה לחדשה אוטומטית.

## 1. לקנות את הדומיין
אצל רשם שמוכר דומיינים ‎.co.il. לא צריך חבילת אחסון, רק את הדומיין עצמו. כדאי לבדוק גם את מחיר החידוש.

## 2. להגדיר DNS אצל הרשם
בממשק ניהול ה־DNS של הדומיין מוחקים רשומות ברירת מחדל שמפנות לדף חניה (A או CNAME על השם הראשי ועל `www`), ומוסיפים:

| סוג | שם (Host) | ערך |
|---|---|---|
| A | `@` (השם הראשי) | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `baktanaenglish-hub.github.io` |

לא מוסיפים רשומת wildcard (`*`). עדכון DNS לוקח בין כמה דקות ל־48 שעות.

## 3. לחבר את הדומיין ב־GitHub
1. **אימות הדומיין (מומלץ, מונע השתלטות):** בפרופיל ב־GitHub ← Settings ← Pages ← Add a domain ← `baktanaenglish.co.il`. GitHub נותנת רשומת TXT. מוסיפים אותה אצל הרשם ולוחצים Verify.
2. ב־repo: ‏Settings ← Pages ← Custom domain ← `baktanaenglish.co.il` ← Save. מחכים שהבדיקה תעבור.
3. מסמנים **Enforce HTTPS**. אם האפשרות אפורה, מחכים קצת: GitHub מנפיקה תעודה בחינם, וזה יכול לקחת עד שעה.

## 4. להגדיר את הכתובת לבנייה
ב־repo: ‏Settings ← Secrets and variables ← Actions ← לשונית **Variables** ← New repository variable:

| שם | ערך |
|---|---|
| `VITE_SITE_URL` | `https://baktanaenglish.co.il/` |

בזכות המשתנה הזה, גם אפליקציית האנדרואיד פותחת את דפי הפרטיות בדומיין החדש, ומיילי אישור ההרשמה שולחים לשם.

## 5. לעדכן את Supabase
ב־Supabase: ‏Authentication ← URL Configuration:
- **Site URL:** `https://baktanaenglish.co.il/`
- **Redirect URLs** ← Add URL: `https://baktanaenglish.co.il/**`. משאירים גם את הכתובת הישנה של github.io, כי מיילים שכבר נשלחו מפנים אליה.

## 6. לבנות מחדש
ב־repo: ‏Actions ← **Android APK** ← Run workflow (על `main`). בסיומה רץ אוטומטית גם **Deploy to GitHub Pages**.

## 7. לבדוק
- `https://baktanaenglish.co.il` נפתח עם מנעול (HTTPS).
- `https://baktanaenglish.co.il/privacy.html` נפתח.
- `https://baktanaenglish-hub.github.io/baktana-english/` מפנה לכתובת החדשה.
- הרשמה עם חשבון חדש: הקישור במייל האישור מוביל ל־`baktanaenglish.co.il`.

## אחרי המעבר
- בטפסים של Google Play: מדיניות הפרטיות היא `https://baktanaenglish.co.il/privacy.html`, וכתובת מחיקת החשבון היא `https://baktanaenglish.co.il/privacy.html#delete` ([store-release.md](store-release.md)).
- **עדכונים ל־APK ממשיכים לעבוד:** האפליקציה בודקת עדכונים בדף הגרסאות של GitHub, ולא באתר.
- **ההתקדמות של אורחים באתר לא עוברת לכתובת החדשה.** הדפדפן שומר את הנתונים לפי כתובת האתר, ולכן אורח שלמד ב־github.io יתחיל מההתחלה בדומיין החדש. מי שיש לו חשבון מתחבר ומקבל את ההתקדמות שלו. כדאי לעבור לדומיין מוקדם, לפני שיש הרבה משתמשים.
