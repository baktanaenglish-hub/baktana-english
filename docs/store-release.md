# פרסום ב־Google Play – רשימת הכנה

המסמך מרכז את מה שצריך כדי להעלות את Baktana English ל־Google Play: מה כבר מוכן בקוד, מה נשאר לעשות ידנית, ותשובות מוכנות לטפסים של Play Console.
App Store (אייפון) הוא שלב נפרד בהמשך (ראו בסוף).

## מה מוכן בקוד

| דרישה | איפה |
|---|---|
| **מחיקת חשבון מתוך האפליקציה** (חובה כשיש הרשמה) | פרופיל ← "מחיקת החשבון", עם אימות סיסמה. שרת: `DELETE /api/me` ([api.md](api.md)). Supabase: `delete_my_account()` ([supabase.md](supabase.md#מחיקת-חשבון)) |
| **קישור למחיקת חשבון מחוץ לאפליקציה** (Play מבקשת URL) | `privacy.html#delete` באתר |
| **מדיניות פרטיות ותנאי שימוש** | `public/privacy.html`, `public/terms.html`. הם מתפרסמים עם האתר ומקושרים מהפרופיל ומטופס ההרשמה |
| **בלי `REQUEST_INSTALL_PACKAGES`** בגרסה לחנות | flavor `play` ([android.md](android.md)) |
| **Android App Bundle חתום** (`.aab`) | `.github/workflows/android.yml` בונה אותו כשסודות מפתח ההעלאה מוגדרים |
| **targetSdk עדכני** | 36 (`android/variables.gradle`) |

## מה נשאר לעשות (בסדר הזה)

### 1. להשלים פרטים בדפי המשפט
- כתובת ליצירת קשר בדפים: `support.baktanaenglish@gmail.com`, כתובת ייעודית לאפליקציה (מופיעה גם בסעיף 6 של `privacy.html` ובסוף `terms.html`). אם מחליפים אותה, מעדכנים בשני הקבצים, ב־`docs/legal-premium-draft.md` ובדף החנות (`store-assets/listing.md`).
- כדאי שעורך דין יעבור על הדפים, במיוחד אם יתווספו תשלומים או פרסומות. הם נכתבו לפי מה שהאפליקציה עושה היום, אבל הם לא ייעוץ משפטי.

### 2. קהל היעד – הוחלט: 13 ומעלה
ב־Play Console ‏(App content ← Target audience and content) מסמנים רק את קבוצות הגיל **13–15, 16–17 ו־18+**, ועונים No על "Could your app unintentionally appeal to children?" אם דף החנות לא מכוון לילדים.
דפי הפרטיות והתנאים כבר אומרים שהשירות מיועד לגיל 13 ומעלה. בדף החנות (צילומי מסך, תיאור, גרפיקה) נמנעים מניסוחים כמו "לילדים" ומדמויות או סגנון שנראים מכוונים לילדים, אחרת גוגל עלולה לסווג את האפליקציה מחדש תחת מדיניות Families.

לשם השוואה, אם נרצה בעתיד לפנות גם לילדים:

| בחירה | משמעות |
|---|---|
| **13 ומעלה** (הבחירה הנוכחית) | הכי פשוט. צריך להימנע מעיצוב שנראה "מכוון לילדים" בדף החנות |
| **כולל ילדים מתחת ל־13** | חלה מדיניות Families: דרישות על איסוף מידע מילדים, פרסומות רק מספקים מאושרים, ובדרך כלל גם מסך גיל לפני הרשמה. מאפשר להופיע בלשונית "ילדים" ובתוכנית Teacher Approved |

מעבר לילדים ידרוש עוד עבודה בקוד (מסך גיל, ואולי חסימת הרשמה מתחת לגיל מסוים), ועדיף להחליט עליו לפני שמוסיפים פרסומות.

### 3. לעדכן את Supabase
מריצים שוב את כל `supabase/schema.sql` ב־SQL Editor, כדי שתיווצר הפונקציה `delete_my_account()`. בלי זה מחיקת החשבון באתר ובאפליקציה תיכשל.

### 4. ליצור מפתח העלאה ולשמור אותו ב־GitHub
מריצים פעם אחת במחשב (צריך Java):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks > upload.jks.b64   # במק: base64 -i upload.jks -o upload.jks.b64
```

ב־GitHub: ‏Settings ← Secrets and variables ← Actions ← New repository secret:

| סוד | ערך |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | התוכן של `upload.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | הסיסמה שבחרתם ל־keystore |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | סיסמת המפתח (בדרך כלל אותה סיסמה) |

**שומרים את `upload.jks` והסיסמה במקום בטוח מחוץ ל־repo** (למשל במנהל סיסמאות), ולא מעלים אותם ל־git. ב־Play App Signing גוגל מחזיקה את מפתח החתימה הסופי, ואם מפתח ההעלאה אובד אפשר לבקש ממנה לאפס אותו.

מהדחיפה הבאה ל־`main` (או בהרצה ידנית של ה־workflow ‏Android APK), הקובץ `BaktanaEnglish-play-bundle` (‏`app-play-release.aab`) מופיע ב־Artifacts של הריצה.

> **שימו לב:** ה־APK מ־GitHub (`com.baktana.english.sideload`) וגרסת Play (`com.baktana.english`) הן שתי אפליקציות נפרדות בטלפון: מזהה שונה ומפתח חתימה שונה. אפשר להתקין את שתיהן, אבל ההתקדמות לא עוברת ביניהן לבד. מי שעובר ל־Play צריך חשבון מסונכרן כדי לשמור את ההתקדמות, ואז יכול להסיר את ה־APK.

### 5. לפתוח חשבון ב־Play Console
- https://play.google.com/console, תשלום חד־פעמי של 25$ ואימות זהות.
- **חשבון אישי:** לפני פרסום ציבורי חובה להריץ **בדיקה סגורה עם לפחות 12 בודקים במשך 14 יום רצופים**. בחשבון ארגוני (צריך עסק רשום ומספר D-U-N-S) הדרישה הזאת לא חלה.
- גייסו מראש 12 ומעלה אנשים עם טלפון אנדרואיד וחשבון Google: משפחה, חברים, קבוצות לומדי אנגלית.

### 6. ליצור את האפליקציה ולהעלות
1. Create app: שם `Baktana English: לומדים אנגלית` (עד 30 תווים), שפת ברירת מחדל עברית, App, Free. מזהה החבילה של גרסת Play הוא `com.baktana.english`, ואי אפשר לשנות אותו אחרי ההעלאה הראשונה.
2. Testing ← Closed testing ← יוצרים track, מוסיפים את הבודקים (רשימת אימיילים או Google Group), ומעלים את ה־`.aab`.
3. שולחים לבודקים את קישור ההצטרפות. הם צריכים להצטרף, להתקין ולהשתמש באפליקציה לאורך 14 הימים.
4. אחרי 14 יום: Apply for production. ממלאים את השאלון על הבדיקה ומעלים לפרודקשן.

### 7. למלא את טפסי App content
תשובות לפי מה שהאפליקציה עושה היום. אם מוסיפים פרסומות, תשלומים או SDK חדש, צריך לעדכן.

**Privacy policy:** `https://baktanaenglish.co.il/privacy.html` (אחרי המעבר לדומיין, [domain.md](domain.md). עד אז: `https://baktanaenglish-hub.github.io/baktana-english/privacy.html`)

**App access:** כל האפליקציה זמינה בלי התחברות (מצב אורח). כדאי בכל זאת לתת לבודקים של גוגל חשבון בדיקה (אימייל וסיסמה) כדי שיוכלו לבדוק את הליגה ואת מחיקת החשבון.

**Ads:** No.

**Content rating (IARC):** קטגוריה Reference, News, or Educational. אין אלימות, מין, שפה גסה, הימורים או סמים. לגבי אינטראקציה בין משתמשים: אין צ'אט או שיתוף תוכן. רק שם התצוגה שהמשתמש בחר מוצג לאחרים בליגה. מציינים את זה בכנות.

**Target audience:** ‏13–15, 16–17, 18+ (שלב 2).

**Data safety:**

| שאלה | תשובה |
|---|---|
| Does your app collect or share user data? | Yes (collects; does **not** share) |
| Is all data encrypted in transit? | Yes (HTTPS בלבד) |
| Do you provide a way for users to request deletion? | Yes. URL: `https://baktanaenglish.co.il/privacy.html#delete` |

| סוג מידע (Play) | נאסף? | אופציונלי? | מטרה | הערות |
|---|---|---|---|---|
| Personal info → **Email address** | כן | כן (רק למי שיוצר חשבון) | Account management, App functionality | |
| Personal info → **Name** | כן | כן | Account management, App functionality | שם התצוגה, מוצג בליגה |
| App activity → **App interactions** | כן | כן (אפשר לכבות בפרופיל) | Analytics, App functionality | אירועי שיעור ותשובות, וההתקדמות לסנכרון |
| Device or other IDs | כן | כן | Analytics | מזהה התקנה אקראי (`anon_id`), לא מזהה מכשיר |
| Audio → **Voice or sound recordings** | כן, עיבוד רגעי (ephemeral) | כן (אפשר לכבות תרגילי דיבור) | App functionality | זיהוי הדיבור של המכשיר (Google). אנחנו לא שומרים הקלטה או טקסט. הצהרה שמרנית: כך לא יתגלה פער מול הרשאת `RECORD_AUDIO` |

שום מידע לא מועבר לצד שלישי לפרסום או לשיווק. Supabase הוא ספק שירות (service provider), ולכן לא נחשב "shared".

### 8. דף החנות (Store listing)
- **אייקון:** 512×512 PNG. מרנדרים מהלוגו ב־`public/icons/` (ראו `tools/render-icons.mjs`).
- **Feature graphic:** 1024×500.
- **צילומי מסך:** לפחות 2 (מומלץ 4–8) מטלפון: מסלול הלימוד, תרגיל, סיום שיעור, ליגה.
- **תיאור קצר** (עד 80 תווים), הצעה:
  > לומדים אנגלית בעברית: שיעורים קצרים, חזרה חכמה ותרגול דיבור – בלי הרשמה.
- **תיאור מלא**, הצעה לפתיחה:
  > Baktana English נבנתה במיוחד לדוברי עברית: ההסברים בעברית, והתרגילים מתמקדים בטעויות שישראלים עושים באנגלית (is/am/are, a/the, סדר מילים ועוד).
  > • 12 יחידות ו־64 שיעורים קצרים, מרמת מתחילים ועד A2
  > • תרגילי בחירה, התאמה, בניית משפטים, האזנה ודיבור
  > • חזרה מרווחת שמזכירה בדיוק את המילים שצריך לחזור עליהן
  > • XP, רצף ימים, יעד יומי וליגה שבועית
  > • עובד גם בלי אינטרנט, ואפשר להתחיל בלי הרשמה
- **קטגוריה:** Education. **אימייל ליצירת קשר:** `support.baktanaenglish@gmail.com` (כמו בדפי המשפט).

## בהמשך: App Store (אייפון)
- חשבון Apple Developer: ‏99$ לשנה.
- מוסיפים את `@capacitor/ios` ובונים במק או בשירות בנייה בענן.
- צריך לכתוב ב־Swift תוסף זיהוי דיבור שמקביל ל־`SpeechRecognizerPlugin.java`.
- מחיקת חשבון ומדיניות פרטיות כבר מוכנות, וגם App Store מחייב אותן.
- ב־App Store Connect ממלאים "App Privacy" עם אותם סוגי מידע כמו בטבלה למעלה.
