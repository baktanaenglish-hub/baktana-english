# מנוי פרימיום: תשלומים, חנויות, מיסוי וארכיטקטורה

המסמך מרכז את מה שצריך כדי למכור מנוי "פרימיום" ב־Baktana English: המנוי פותח את שיחות הווידאו עם ה־AI (עד 10 שיחות ביום, `CALL_LIMITS.callsPerDay` ב־`shared/call.ts`).
פרימיום נקבע בצד השרת: אימייל ברשימה `PREMIUM_EMAILS` (`shared/premium.ts`), **או** מנוי בתוקף בטבלה `entitlements` ב־Supabase.

> **מצב ב־21 באוקטובר 2026: הקוד מוכן ומחכה להגדרות.** הטבלאות, ה־webhook (`billing-webhook`), הבדיקה ב־`call-turn`, החיבור ל־RevenueCat באפליקציה ומסך המנוי ממומשים (שלב 3 למטה). כל עוד המשתנה `VITE_REVENUECAT_ANDROID_KEY` לא הוגדר, שום דבר לא נמכר והאפליקציה נראית כמו קודם: בלשונית השיחות "בקרוב! שיחות וידאו יהיו חלק מפרימיום", בלי מסך מנוי ובלי כרטיס פרימיום בפרופיל (`PREMIUM_ON_SALE` ב־`src/lib/billing.ts`). כשמגדירים אותו, האפליקציה מ־Google Play מוכרת, והאתר וה־APK להורדה מסבירים שמצטרפים דרך האפליקציה מ־Google Play. הסעיפים על המנוי בתנאי השימוש ובמדיניות הפרטיות מחכים ב־[legal-premium-draft.md](legal-premium-draft.md). מה שנשאר הוא בעיקר שלבים 0–2 ו־4–5, ו[פרק 7](#7-מה-צריך-ממך-רק-הבעלים-יכולה).

> **נבדק ב־19 באוקטובר 2026.** עמלות ומדיניות של Google ו־Apple השתנו כמה פעמים ב־2025–2026, בעיקר בעקבות תביעות Epic. כל טענה על עמלה או מדיניות מגיעה עם קישור. סימון ⚠️ מציין דבר שלא הצלחתי לאמת במקור רשמי, או שהמקורות סותרים בו. **זה לא ייעוץ משפטי או ייעוץ מס.** את פרק 5 צריך לאשר מול רואה חשבון.
>
> הערה על המקורות: דפי העזרה של Google (‏support.google.com) לא היו נגישים לקריאה ישירה מסביבת העבודה. לכן הנתונים מהם מגיעים מתוצאות חיפוש ומהתיעוד ב־developer.android.com, שכן נקרא ישירות.

## תקציר

| נושא               | השורה התחתונה                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **חובה באנדרואיד** | ב־Google Play מוכרים מנוי דיגיטלי רק דרך Google Play Billing. בישראל אין כרגע חיוב חלופי (Billing Choice / User Choice). אסור לקשר מהאפליקציה לתשלום באתר                                                                                               |
| **עמלת Google**    | ‏**15%** על מנויים מתחדשים, מהשקל הראשון ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)). מבנה חדש (10% שירות ועוד 5% חיוב) כבר פעיל בארה"ב, בבריטניה וב־EEA, ואמור להגיע לשאר העולם עד 30.9.2027 ⚠️ |
| **אייפון (בעתיד)** | ‏In-App Purchase חובה. בתוכנית Small Business העמלה **15%** ([Apple](https://developer.apple.com/app-store/small-business-program/)). קישור לתשלום חיצוני מותר רק בחנויות של ארה"ב, האיחוד האירופי ויפן, לא בישראל                                      |
| **אתר**            | אפשר למכור באתר ב־Paddle או Lemon Squeezy (הם ה־Merchant of Record), או בסליקה ישראלית (Cardcom / Tranzila / Grow). מי שקנה באתר יכול להשתמש בפרימיום באפליקציה. האפליקציה רק לא מפנה לאתר                                                              |
| **ספריה מומלצת**   | ‏**RevenueCat** (`@revenuecat/purchases-capacitor` 13.7.4, תומך Capacitor 8). חינם עד 2,500$ הכנסה חודשית, אחר כך 1%                                                                                                                                    |
| **ארכיטקטורה**     | טבלת `entitlements` ב־Supabase עם `premium_until`. Webhook של RevenueCat מעדכן אותה דרך Edge Function. `call-turn` בודק אותה במקום רק את `PREMIUM_EMAILS`                                                                                               |
| **מחיר מוצע**      | ‏**19.90 ₪ לחודש** או **149 ₪ לשנה**, עם 7 ימי ניסיון. אחרי עמלה ומע"מ נשארים כ־13.9 ₪ לחודש. עלות ה־AI במקרה הגרוע היא כ־4.5 ₪ (ראו [חישוב](#תמחור-מוצע-וחישוב-רווח))                                                                                  |
| **מיסוי**          | צריך לפתוח תיק עוסק (פטור או מורשה) לפני שמקבלים כסף. הטיפול במע"מ על מכירות דרך Google ללקוחות בישראל **לא ברור**, ויש לברר אותו מול רואה חשבון ⚠️                                                                                                     |

---

## 1. Google Play Billing

### חובת השימוש ומה מותר

- **הכלל:** אפליקציה שמופצת ב־Google Play ומוכרת תוכן או שירות דיגיטלי (מנוי, פיצ'ר) חייבת למכור אותו דרך Google Play Billing. Google מתירה אפליקציה שהיא **"consumption-only"**: אפליקציה שלא מוכרת כלום, והמשתמש רק נכנס בה לשירות שקנה במקום אחר ([Understanding Google Play's Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)).
- **הפניה החוצה (steering):** מחוץ לתוכניות המיוחדות, האפליקציה לא יכולה להוביל משתמשים לאמצעי תשלום אחר: לא קישורים, לא כפתורים, לא WebView, לא באנרים ולא ניסוח מעודד, וגם לא בדף החנות או בתהליך ההרשמה ([Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)). מותר לפנות למשתמשים **מחוץ לאפליקציה**, למשל במייל.
- **ארה"ב:** בעקבות צו המניעה ב־Epic v. Google, החל מ־29.10.2025 Google לא אוסרת על מפתחים לספר למשתמשים **בארה"ב** על מחירים ותשלום מחוץ ל־Play, ולא מחייבת שם את Play Billing ([Play Console Help – US](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en), [Business Wire](https://www.businesswire.com/news/home/20251029226256/en)). ⚠️ מצב ההסדר בין Epic ל־Google לא ברור: ההסדר נחתם ב־4.3.2026 ולפי דיווח אחד בוטל ב־15.7.2026 ([Appcharge](https://www.appcharge.com/blog/epic-v-google-the-settlement-is-off-the-table)). זה לא משנה לנו, כי זה חל רק על משתמשים בארה"ב.
- **חיוב חלופי (User Choice / Billing Choice):** פיילוט החיוב החלופי פתוח כרגע ב־EEA, אוסטרליה, ברזיל, אינדונזיה, יפן, דרום אפריקה, בריטניה וארה"ב ([Enrolling in the user choice billing pilot](https://support.google.com/googleplay/android-developer/answer/12570971)). **ישראל לא ברשימה.** תוכנית Billing Choice החדשה עלתה ב־30.6.2026 בארה"ב, בבריטניה וב־EEA. לפי הדיווחים "שאר העולם" יקבל אותה עד 30.9.2027 ([gHacks](https://www.ghacks.net/2026/06/25/google-play-billing-choice-program-goes-live-june-30-with-lower-developer-fees-and-third-party-billing/), [TechCrunch](https://techcrunch.com/2026/03/04/google-settles-with-epic-games-drops-its-play-store-commissions-to-20)). ⚠️ לא מצאתי אישור רשמי שישראל כלולה.

**המשמעות לנו:** בגרסת `play` מוכרים רק דרך Play Billing, ואין באפליקציה שום הפניה לרכישה באתר. מי שכבר קנה באתר נכנס עם החשבון שלו ומקבל פרימיום. זה מותר (ראו [פרק 3](#מי-שקנה-באתר--מה-מותר-באפליקציה)).

### עמלה

| מצב                                        | עמלה                                                                               | מקור                                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| מנוי מתחדש (auto-renewing), בישראל היום    | **15%** מהשקל הראשון, בלי קשר להכנסה השנתית                                        | [Service fees – Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)                                                                   |
| רכישה חד־פעמית, מיליון הדולר הראשונים בשנה | 15% (נדרשת הרשמה לתוכנית 15%). מעל מיליון: 30%                                     | אותו מקור                                                                                                                                                                         |
| ארה"ב, בריטניה, EEA מ־30.6.2026            | מנויים: 10% דמי שירות ועוד 5% דמי חיוב כשמשתמשים ב־Play Billing, כלומר עדיין כ־15% | [9to5Google](https://9to5google.com/2026/06/24/google-play-store-external-billing-june-30/), [PricePush](https://pricepush.app/blog/google-play-subscription-fees-2026-real-math) |

⚠️ דף העמלות הרשמי עוד מציג 15% למנויים. אם המבנה החדש יגיע לישראל, העלות דרך Play Billing כנראה תישאר כ־15%, וההבדל יהיה רק בתשלום חלופי.

### מבנה המוצר: מנוי, Base plan, Offer

- **Subscription:** מוצר אחד, למשל `premium`. בתוכו מגדירים **Base plans** ו־**Offers** ([Android Developers – Subscriptions](https://developer.android.com/google/play/billing/subscriptions)).
- **Base plan:** תקופה ומחיר. אצלנו `monthly` ו־`yearly`, שניהם auto-renewing. יש גם prepaid (בלי חידוש אוטומטי, המשתמש "ממלא" תקופה) ו־installments (רק בברזיל, צרפת, איטליה וספרד).
- **Offer:** הנחה או ניסיון על base plan. למשל `trial-7d`: שבוע חינם למשתמשים חדשים. Google בודקת אמצעי תשלום תקין לפני שהניסיון מתחיל, ובסופו מחייבת מחיר מלא. מי שמבטל בזמן הניסיון נשאר עם גישה עד סופו ולא מחויב (אותו מקור).
- **שינוי תוכנית** (חודשי ל־שנתי): כל שינוי הוא רכישה חדשה עם `linkedPurchaseToken`. מומלץ `CHARGE_PRORATED_PRICE` לשדרוג ו־`DEFERRED` לשנמוך (אותו מקור).
- **Restore / Resubscribe:** תמיכה ב־Restore (חידוש מנוי שבוטל לפני שפג) היא חובה. Resubscribe אחרי שפג אפשרי עד שנה (אותו מקור).

### כשל תשלום: Grace period ו־Account hold

| שלב                              | מה קורה                                                             | גישה לפרימיום |
| -------------------------------- | ------------------------------------------------------------------- | ------------- |
| **Silent grace** (לפחות 24 שעות) | Play מנסה לחייב שוב. המצב עדיין `ACTIVE`                            | כן            |
| **Grace period**                 | `SUBSCRIPTION_STATE_IN_GRACE_PERIOD`, ו־`expiryTime` מוארך          | **כן**        |
| **Account hold**                 | ברירת מחדל: 60 יום פחות אורך ה־grace. ‏`SUBSCRIPTION_STATE_ON_HOLD` | **לא**        |
| תיקון אמצעי התשלום               | `SUBSCRIPTION_RECOVERED`                                            | חוזרת         |
| לא תוקן                          | `SUBSCRIPTION_CANCELED` ואחריו `SUBSCRIPTION_EXPIRED`               | לא            |

מקור: [Android Developers – Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions). ברירת המחדל של account hold השתנתה ב־1.12.2025 לחישוב אוטומטי ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/16631229?hl=en)). את אורך ה־grace בוחרים לכל base plan. ⚠️ לא אימתתי את ברירת המחדל המדויקת, ובדרך כלל משאירים את מה שה־Console מציע.
Play מציגה הודעה בתוך האפליקציה בזמן grace ו־hold אם קוראים ל־`showInAppMessages()`. ‏RevenueCat עושה את זה בשבילנו.

### מחירים בשקלים

- קובעים מחיר בסיס, ו־Play ממירה אותו למטבע מקומי ומעגלת לפי דפוסי מחיר מקומיים. אפשר לדרוס ידנית את המחיר לכל מדינה ([Set up your app's prices](https://support.google.com/googleplay/android-developer/answer/6334373?hl=en)).
- **ההמלצה:** לקבוע ידנית מחיר עגול בש"ח לישראל (19.90 ₪), ולתת ל־Play לחשב לשאר המדינות.
- ⚠️ האם Google מוסיפה מע"מ ישראלי למחיר שהמשתמש רואה תלוי בשאלה אם Google גובה מס בישראל. ראו [פרק 5](#מעמ-מי-גובה).
- שינוי מחיר למנויים קיימים: העלאה דורשת הסכמה (opt-in) או הודעה מוקדמת, לפי המדינה. ⚠️ לא נבדק לעומק. כדאי לקבוע מחיר שלא צריך להעלות בשנה הראשונה.

### החזרים

- Google מחזירה כסף בעצמה בעיקר בתוך **48 שעות** מהרכישה. אחרי זה היא מפנה את המשתמש למפתח ([Google Play refund policies](https://support.google.com/googleplay/answer/15574908)).
- המפתח יכול להחזיר כסף מ־Play Console ‏(Order management), כולל החזר חלקי, או דרך ה־API (`purchases.subscriptionsv2.revoke`).
- החזר או chargeback שולחים `SUBSCRIPTION_REVOKED`, ואז הגישה נשללת מיד ([Lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)).
- בישראל חל גם חוק הגנת הצרכן ([פרק 5](#חוק-הגנת-הצרכן-ביטול-מנוי)). מדיניות ההחזרים שלנו צריכה לעמוד בו, וזה לא תלוי ב־Google.

### Real-time developer notifications ‏(RTDN)

- Play מפרסמת הודעה ל־**Google Cloud Pub/Sub** בכל שינוי במנוי. מגדירים topic, נותנים ל־`google-play-developer-notifications@system.gserviceaccount.com` את התפקיד Pub/Sub Publisher, ומזינים את שם ה־topic ב־**Monetize ← Monetization setup** ([Getting ready](https://developer.android.com/google/play/billing/getting-ready)).
- ההודעה רק אומרת ש"משהו השתנה". את המצב המלא מקבלים בקריאה ל־`purchases.subscriptionsv2.get` עם ה־purchase token (אותו מקור).
- עלות: Pub/Sub נותן 10 GiB בחודש בחינם ([Pub/Sub pricing](https://cloud.google.com/pubsub/pricing)). להודעות האלה זה בפועל חינם.
- **עם RevenueCat** מפנים את ה־RTDN ל־topic ש־RevenueCat נותנת, והיא מטפלת בשאר. לא צריך שרת משלנו שמאזין ל־Pub/Sub.

### אימות בשרת ואישור רכישה (acknowledge)

- **`purchases.subscriptionsv2.get`** הוא מקור האמת למצב המנוי. ‏`purchases.subscriptions.get` הישן deprecated ([Lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)).
- **חובה לאשר (acknowledge) רכישה חדשה תוך 3 ימים.** אחרת Google מחזירה את הכסף ומבטלת את הרכישה. חידושים לא צריכים אישור. רכישה שנכשלה בבדיקת הונאה לא מאשרים, אלא מבטלים עם `revoke` (אותו מקור).
- גישה מהשרת: Service account ב־Google Cloud עם הרשאת **View financial data** ב־Play Console ([Getting ready](https://developer.android.com/google/play/billing/getting-ready)).
- **Play Billing Library:** מ־31.8.2026 אפליקציות חדשות ועדכונים חייבים גרסה 8 ומעלה (הארכה אפשרית עד 1.11.2026). ב־31.8.2027 צפויה דרישה לגרסה 9 ([Deprecation FAQ](https://developer.android.com/google/play/billing/deprecation-faq)). ‏RevenueCat מעדכנת את הספריה בעצמה.

---

## 2. Apple App Store (לאפליקציית אייפון עתידית)

| נושא                                  | פירוט                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **חובת IAP**                          | פתיחת פיצ'רים או מנוי באפליקציה חייבת לעבור דרך In-App Purchase ‏(Guideline 3.1.1) ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/))                                                                                                                                                                           |
| **מנוי מתחדש**                        | מותר בכל קטגוריה. צריך לתת ערך מתמשך, התקופה המינימלית 7 ימים, והמנוי זמין בכל המכשירים של המשתמש ‏(3.1.2(a)). לפני הרכישה מסבירים בבירור מה מקבלים ‏(3.1.2(c)) (אותו מקור)                                                                                                                                                                      |
| **Multiplatform**                     | מותר לתת גישה למנוי שנקנה באתר או באנדרואיד, **בתנאי שאותו מנוי נמכר גם ב־IAP באפליקציה** ‏(3.1.3(b)) (אותו מקור)                                                                                                                                                                                                                                |
| **עמלה**                              | ‏Small Business Program: **15%** למי שהכנסתו עד מיליון דולר בשנה. ברירת המחדל 30%, ו־15% על מנוי אחרי השנה הראשונה. 10% רק בתנאים החלופיים באיחוד האירופי ([Apple](https://developer.apple.com/app-store/small-business-program/)). נרשמים בנפרד, אחרי שמקבלים את Paid Apps Agreement                                                            |
| **StoreKit 2**                        | ה־API המודרני (Swift async, טרנזקציות חתומות ב־JWS). ‏RevenueCat עוטפת אותו, אז לא צריך לכתוב Swift בשביל הרכישה                                                                                                                                                                                                                                 |
| **App Store Server Notifications V2** | ‏Apple שולחת POST עם `signedPayload` (‏JWS). סוגים עיקריים: `SUBSCRIBED`, ‏`DID_RENEW`, ‏`DID_FAIL_TO_RENEW`, ‏`GRACE_PERIOD_EXPIRED`, ‏`EXPIRED`, ‏`REFUND`. ‏`appAccountToken` מקשר בין טרנזקציה למשתמש שלנו ([Apple docs](https://developer.apple.com/documentation/appstoreservernotifications)). גם כאן RevenueCat מקבלת את ההודעות במקומנו |

### קישור לתשלום חיצוני (anti-steering), מצב באוקטובר 2026

| אזור                     | מצב                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ארה"ב**                | מותר לשים כפתורים וקישורים לרכישה מחוץ לאפליקציה בחנות האמריקאית ([Guidelines 3.1.1(a), 3.1.3](https://developer.apple.com/app-store/review/guidelines/)). בדצמבר 2025 בית המשפט לערעורים (Ninth Circuit) אישר את ממצא הביזיון, אבל ביטל את האיסור הגורף על עמלה והחזיר לערכאה הראשונה לקבוע עמלה "סבירה" ([Fenwick](https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple)). בית המשפט העליון קיבל ב־30.6.2026 ערעור על שאלה צרה, והחלטה צפויה ב־2027 ([AppleInsider](https://appleinsider.com/articles/26/09/14/apple-standing-its-ground-in-epics-app-store-fee-suit)). ⚠️ עד אז, לפי הדיווחים, אין עמלה על קישורים |
| **האיחוד האירופי (DMA)** | מ־1.10.2026 חלים תנאים מאוחדים (Attachment 14). על רכישה בתוך 7 ימים מלחיצה על קישור יש עמלת Store Services ([Apple – EU](https://developer.apple.com/support/apps-in-the-eu/), [Daring Fireball](https://daringfireball.net/2026/08/apple_eu_business_terms_conceding_little)). ⚠️ שיעורים מדויקים רק ממקורות משניים                                                                                                                                                                                                                                                                                                                                               |
| **יפן**                  | קישור החוצה מותר לפי חוק ה־MSCA, עם עמלה של 15% (10% לזכאים) ([PPC Land](https://ppc.land/apple-bends-to-japans-competition-law-with-app-store-and-payment-changes/))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **ישראל ושאר העולם**     | **אסור.** אפליקציה ותיאור החנות לא יכולים לכלול כפתורים, קישורים או קריאה לפעולה שמפנים לרכישה שלא ב־IAP ‏(3.1.1(a), 3.1.3) ([Guidelines](https://developer.apple.com/app-store/review/guidelines/))                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**המשמעות לנו:** באייפון, כמו באנדרואיד, מוכרים רק ב־IAP ובלי הפניה לאתר. מי שקנה באתר או בגוגל פליי מקבל גישה, כל עוד המנוי נמכר גם ב־IAP. ‏Entitlement אחד ב־RevenueCat מאחד את שלוש החנויות.

---

## 3. רכישה באתר (GitHub Pages)

האתר הוא דף סטטי בלי שרת. לכן התשלום צריך checkout מתארח (hosted), ו־webhook שמעדכן את Supabase.

### Merchant of Record ‏(MoR) – למה זה חשוב

- **MoR** הוא מי שמוכר ללקוח באופן רשמי. הוא גובה ומעביר מע"מ ומס מכירה בכל מדינה, מנפיק חשבונית ללקוח ומטפל ב־chargebacks. כך המפתח לא צריך להירשם למע"מ באיחוד האירופי, בבריטניה וכו'.
- ב־Google Play וב־App Store, החנות היא ה־MoR (מול הלקוח).
- בסליקה ישראלית **אנחנו** המוכרים, ואנחנו מנפיקים חשבונית ומדווחים מע"מ.

| ספק                             | סוג                             | עמלה                                                                                                                                  | ישראל                                                                                                                                                                                                       | הערות                                                                                                                                                                    |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Paddle**                      | MoR                             | ‏5% ‏+ 0.50$ לעסקה ([Rework](https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy))                             | לפי מדריך ישראלי, ישראל מופיעה כמדינת מוכר נתמכת ([adircpa](https://adircpa.com/en/guides/stripe-israel-tax)). ⚠️ לאמת מול Paddle                                                                           | אינטגרציה רשמית עם RevenueCat ([RevenueCat – Paddle](https://revenuecat.com/docs/web/integrations/paddle)). אישור החשבון ידני, צריך אתר עם מחירים, תנאים ומדיניות החזרים |
| **Lemon Squeezy**               | MoR                             | ‏5% ‏+ 0.50$ ([Dodo Payments](https://dodopayments.com/blogs/lemonsqueezy-review))                                                    | תשלום ב־PayPal לכ־200 מדינות. העברה בנקאית רק למדינות ברשימה ([Lemon Squeezy](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)). ⚠️ לבדוק אם ישראל ברשימה                            | נרכשה על ידי Stripe. עדיין מקבלת נרשמים חדשים, אבל העתיד שלה לא ברור ([Framekit](https://framekit.ai/blog/lemon-squeezy-vs-stripe-2026))                                 |
| **Stripe** (+ Managed Payments) | סולק, או MoR ב־Managed Payments | ‏Managed Payments: ‏3.5% מעל עמלות Stripe ([DesignRevision](https://designrevision.com/blog/stripe-vs-lemonsqueezy))                  | **לא זמין לעסקים ישראליים** לפי רוב המקורות ([adircpa](https://adircpa.com/en/guides/stripe-israel-tax), [Hospitable](https://hospitable.featurebase.app/p/expanding-payment-infrastructure-beyond-stripe)) | ‏RevenueCat Web Billing עובד רק עם Stripe ([RevenueCat](https://revenuecat.com/docs/web/web-billing/configuring-overview)), ולכן לא רלוונטי לנו                          |
| **Cardcom**                     | סולק ישראלי                     | בסביבות 3.5% ‏+ 1 ₪ במסלול הבסיסי, ובפועל לפי הצעה ([AutoFlowr](https://www.autoflowr.co.il/compare/payment-gateways-israel-2026)) ⚠️ | כן                                                                                                                                                                                                          | הוראת קבע באשראי, חשבונית אוטומטית ([Cardcom](https://www.cardcom.solutions/%D7%97%D7%99%D7%95%D7%91-%D7%91%D7%94%D7%95%D7%A8%D7%90%D7%AA-%D7%A7%D7%91%D7%A2/))          |
| **Tranzila**                    | סולק ישראלי                     | לפי הצעה                                                                                                                              | כן                                                                                                                                                                                                          | מוצר מנויים My-Billing ‏([Tranzila](https://www.tranzila.com/%D7%97%D7%99%D7%95%D7%91-%D7%97%D7%95%D7%96%D7%A8/)). ל־API יש סביבת בדיקות                                 |
| **Grow (משולם)**                | סולק ישראלי                     | לפי הצעה                                                                                                                              | כן                                                                                                                                                                                                          | פורטל מפתחים. הוראת קבע קיימת ([השוואה](https://yehonatandev.com/he/blog/israeli-payment-provider-api-comparison))                                                       |

**המלצה לאתר:** לא בשלב הראשון. רוב המשתמשים יגיעו מהאפליקציה. כשנרצה לפתוח מכירה באתר:

- **Paddle**, אם מוכרים גם מחוץ לישראל. יש אינטגרציה מוכנה עם RevenueCat, ו־Paddle מטפלת במע"מ הזר.
- **סולק ישראלי**, אם המכירה רק לישראלים. העמלה נמוכה יותר, והלקוח מקבל חשבונית בשקלים. אבל צריך לבנות webhook ולוגיקת מנוי בעצמנו, ולטפל בביטולים לפי חוק הגנת הצרכן.

### מי שקנה באתר – מה מותר באפליקציה

| מותר                                                                                                                                                                                                                                                  | אסור (בגרסת Play ובאייפון, מחוץ לארה"ב)                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| משתמש שקנה באתר נכנס לחשבון באפליקציה ומקבל פרימיום ([Payments policy – consumption-only](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en), [Apple 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/)) | כפתור, קישור או WebView לדף התשלום באתר                  |
| לשלוח מייל למשתמשים על מבצע באתר (תקשורת מחוץ לאפליקציה)                                                                                                                                                                                              | טקסט כמו "באתר זה זול יותר" או "אפשר לשלם באתר"          |
| להציג "המנוי שלך פעיל (נרכש באתר)" במסך הפרופיל                                                                                                                                                                                                       | קישור לאתר בדף החנות או בתהליך ההרשמה, כשהמטרה היא תשלום |

**שימו לב:** אם האפליקציה גם מוכרת דרך Play Billing, היא כבר לא "consumption-only". מותר לה לתת גישה למנוי מהאתר, אבל ההגבלה על הפנייה לאתר חלה עליה במלואה.

### ה־APK להורדה (flavor `sideload`)

ה־APK מ־GitHub לא מופץ דרך Google Play, ולכן מדיניות התשלומים של Play לא חלה עליו. אפשר להציג בו כפתור "לרכישה באתר" שפותח את דף התשלום בדפדפן.
כדאי להפריד את זה בקוד לפי flavor (דגל build, בדומה ל־`BuildConfig.IN_APP_UPDATES`), כדי שהכפתור לא יגיע בטעות לגרסת `play`. ‏Play Billing כנראה לא יעבוד ב־APK שלא הותקן מ־Play. ⚠️ לא נבדק.

---

## 4. אינטגרציה ב־Capacitor – השוואה

|                               | **RevenueCat**                                                                                                                                                                                                  | **cordova-plugin-purchase (CdvPurchase)**                                      | **פיתוח עצמי**                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| חבילה                         | `@revenuecat/purchases-capacitor` 13.7.4, ‏peer ‏`@capacitor/core >=8.0.0` (npm, 13.10.2026)                                                                                                                    | `capacitor-plugin-cdv-purchase` 13.19.1, ‏peer Capacitor 6–8 (npm, 14.10.2026) | תוסף Java משלנו (כמו `SpeechRecognizerPlugin`) מעל Play Billing Library 8, ובעתיד Swift ל־StoreKit 2 |
| אימות רכישות בשרת             | מובנה (השרתים של RevenueCat)                                                                                                                                                                                    | צריך שרת: Iaptic בתשלום, או שרת משלנו                                          | שרת משלנו: Edge Function שקורא ל־`subscriptionsv2` עם service account                                |
| RTDN / Apple notifications    | ‏RevenueCat מקבלת                                                                                                                                                                                               | בעצמנו (או Iaptic)                                                             | בעצמנו: Pub/Sub ‏push ל־Edge Function, ואימות JWS של Apple                                           |
| Acknowledge תוך 3 ימים        | אוטומטי                                                                                                                                                                                                         | מובנה ב־`finish()`                                                             | בעצמנו                                                                                               |
| Entitlements (מה המשתמש מקבל) | מובנה, כולל מיזוג Play + Apple + Paddle                                                                                                                                                                         | אין, בונים בעצמנו                                                              | בונים בעצמנו                                                                                         |
| Webhook לשרת שלנו             | כן: `INITIAL_PURCHASE`, ‏`RENEWAL`, ‏`CANCELLATION`, ‏`EXPIRATION`, ‏`BILLING_ISSUE` ועוד, עם Authorization header שאנחנו קובעים ([RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)) | לא                                                                             | לא רלוונטי                                                                                           |
| מחיר                          | חינם עד **2,500$ MTR**, ואחר כך **1%** ([Costbench](https://costbench.com/software/subscription-billing/revenuecat/)). ⚠️ לא ברור אם ה־1% על כל ההכנסה או רק על מה שמעל הסף                                     | הספריה חינמית (MIT). ‏Iaptic בתשלום                                            | חינם, אבל ימים־שבועות של פיתוח ותחזוקה                                                               |
| עדכוני Billing Library        | ‏RevenueCat מעדכנת                                                                                                                                                                                              | המתחזק מעדכן                                                                   | אנחנו, כל שנה (דדליין 31 באוגוסט)                                                                    |
| תלות בצד שלישי                | גבוהה (אבל אפשר לייצא נתונים)                                                                                                                                                                                   | בינונית                                                                        | אין                                                                                                  |

**ההמלצה: RevenueCat.**

1. **אין לנו שרת תמידי.** האתר והאפליקציה עובדים מול Supabase בלבד. ‏RevenueCat חוסכת את קבלת ה־RTDN, הקריאות ל־Google API, ה־acknowledge, ובעתיד גם את אימות ה־JWS של Apple. כל זה מצטמצם ל־webhook אחד שאנחנו מקבלים ב־Edge Function.
2. **בחינם בקנה המידה שלנו.** ‏2,500$ בחודש הם כ־400 מנויים במחיר 19.90 ₪. עד שם לא משלמים כלום.
3. **מוכנה לאייפון ולאתר.** אותו entitlement ‏`premium` יעבוד ב־iOS וב־Paddle, בלי לשנות את Supabase.
4. **תומכת ב־Capacitor 8** (peer dependency ב־npm).
5. **Supabase:** קוראים ל־`Purchases.logIn({ appUserID: <supabase user id> })` אחרי ההתחברות. ה־webhook מגיע עם `app_user_id`, שזה ה־UUID של המשתמש ב־Supabase. לא משתמשים באימייל כמזהה ([RevenueCat – identify user](https://tessl.io/registry/skills/github/RevenueCat/ai-toolkit/revenuecat-identify-user)).

**החיסרון:** תלות בספק. אם RevenueCat תעלה מחירים, הנתונים נשארים אצל Google, וה־`entitlements` שלנו ב־Supabase נשארים מקור האמת של האפליקציה. מעבר לפיתוח עצמי יחליף רק את מי שכותב לטבלה.

---

## 5. משפט ומס בישראל

> ⚠️ הפרק הזה הוא רקע, לא ייעוץ. לפני המכירה הראשונה צריך פגישה אחת עם רואה חשבון.

### פתיחת תיק: עוסק פטור או מורשה

- כל הכנסה מעסק מחייבת רישום במע"מ ובמס הכנסה ופתיחת תיק בביטוח לאומי, גם כשהכסף מגיע מ־Google.
- **עוסק פטור:** תקרת מחזור לשנת 2026 היא **122,833 ₪** ([Infinity Finance](https://infinityfinance.co.il/blog/%D7%94%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%94%D7%9E%D7%9C%D7%90-%D7%9C%D7%A2%D7%95%D7%A1%D7%A7-%D7%A4%D7%98%D7%95%D7%A8-2026), [Adir CPA](https://adircpa.com/numbers/osek-patur-ceiling)). עוסק פטור לא גובה מע"מ, מגיש הצהרה שנתית על המחזור עד 31 בינואר, ודוח שנתי למס הכנסה. ⚠️ יש מקצועות שלא יכולים להיות עוסק פטור. רואה החשבון יאשר.
- **עוסק מורשה:** חובה מעל התקרה. מדווח ומשלם מע"מ (18% מ־1.1.2025, ‏[Kintsugi](https://trykintsugi.com/sales-tax-guides/middle-east/israel)) ויכול לקזז מע"מ תשומות.
- **בפועל:** בהתחלה עוסק פטור כנראה מספיק ופשוט יותר. כדאי לבדוק עם רואה חשבון אם מכירה דרך Google בכלל מאפשרת זאת.

### מע"מ: מי גובה?

| ערוץ                   | מי ה־MoR           | מע"מ ישראלי                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Play            | Google (מול הלקוח) | ⚠️ **לא ברור.** לפי Google, ברוב המקומות **המפתח** אחראי למס, ו־Google גובה בעצמה רק במדינות שהיא מציינת (למשל האיחוד האירופי ובריטניה) ([Google Play Help – Tax](https://support.google.com/googleplay/answer/2850368?hl=en), [Play Console – VAT](https://support.google.com/googleplay/android-developer/answer/138000?hl=en-GB)). לא מצאתי אישור שישראל ברשימה. בישראל אין משטר מע"מ ייעודי לספקים דיגיטליים זרים ([Kintsugi](https://trykintsugi.com/sales-tax-guides/middle-east/israel)) |
| App Store              | Apple              | ⚠️ דומה. ‏Apple גובה מס ביותר מ־70 מדינות, ולא מצאתי שישראל ביניהן ([Apple Exhibits](https://developer.apple.com/support/downloads/terms/exhibits/Exhibits-to-Schedule-2-and-3-20250821-English.pdf))                                                                                                                                                                                                                                                                                           |
| Paddle / Lemon Squeezy | הם                 | הם גובים מהלקוח. מבחינתנו, ההכנסה היא תשלום מחברה זרה                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| סולק ישראלי            | אנחנו              | עוסק מורשה גובה 18% ומדווח. עוסק פטור לא גובה                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**השאלה הפתוחה החשובה לרואה החשבון:** כשלקוח **ישראלי** קונה ב־Google Play והכסף מגיע מ־Google (חברה זרה), האם זה "יצוא שירותים" במע"מ אפס לפי סעיף 30(א)(5), או עסקה חייבת ב־18%?
יש פרשנות שלפיה כשהשירות ניתן בפועל לתושב ישראל, אין להחיל אפס ([ביזפורטל](https://www.bizportal.co.il/general/news/article/92777)). זה משנה את הרווח בכ־15% (ראו [חישוב](#תמחור-מוצע-וחישוב-רווח)). שווה לשאול גם על ניכוי במקור: ‏Google עשויה לנכות מס על תשלומים ממדינות מסוימות, ויש שם סעיף על ישראל ([Payments Center – Tax residency](https://support.google.com/paymentscenter/answer/13401799)). ⚠️

### מס הכנסה ודיווח

- ההכנסה היא מה ש־Google מעבירה (אחרי עמלה). הדוחות החודשיים ב־Play Console ‏(Financial reports) הם האסמכתה, וכדאי להוריד אותם כל חודש.
- מס הכנסה וביטוח לאומי על הרווח: הכנסות פחות הוצאות. הוצאות מוכרות אפשריות: עלויות AI ‏(Anthropic), ‏Supabase, ‏Apple Developer, ‏RevenueCat (אם יהיה), מחשב וכו'. רואה חשבון יקבע.
- אם התשלום מגיע בדולרים, צריך חשבון בנק שמקבל העברות מחו"ל.

### Payments profile ב־Play Console

- כדי למכור צריך **payments profile** ב־Google Payments Center שמקושר לחשבון המפתח ([Getting ready](https://developer.android.com/google/play/billing/getting-ready), [Create a payments profile](https://support.google.com/googleplay/android-developer/answer/7161426?hl=en)).
- **חשבון הבנק חייב להיות באותה מדינה של הפרופיל.** כתובת עסק פיזית (לא ת"ד). את מדינת העסק אי אפשר לשנות אחר כך (אותו מקור).
- מטבע ברירת המחדל לפי מיקום הפרופיל. ישראל תומכת במכירה ובתשלום בשקלים כבר שנים ([Android Central](https://www.androidcentral.com/new-countries-can-now-sell-apps-google-play-store)). ⚠️ לאמת בטבלת המדינות ב־Play Console ([Supported locations](https://support.google.com/googleplay/android-developer/answer/9306917)).
- אם חשבון המפתח הוא אישי, הפרופיל יהיה על שם בעל החשבון. השם הזה מופיע ללקוח כמוכר. ⚠️ לבדוק מה מוצג.
- **תזכורת מ־[store-release.md](store-release.md):** בחשבון אישי חובה בדיקה סגורה עם 12 בודקים במשך 14 יום לפני פרסום לכולם.

### חוק הגנת הצרכן: ביטול מנוי

מנוי חודשי הוא **"עסקה מתמשכת"** (סעיף 13ג לחוק הגנת הצרכן, ‏[כל זכות](https://www.kolzchut.org.il/he/%D7%A2%D7%A1%D7%A7%D7%94_%D7%9E%D7%AA%D7%9E%D7%A9%D7%9B%D7%AA)).

| דרישה                                                                          | מה זה אומר לנו                                                                                                                              | מקור                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ביטול בכל עת** והפסקת החיוב תוך **3 ימי עסקים** מהודעת הביטול                | ב־Play: ‏Google מבטלת את החידוש מיד. באתר (סולק ישראלי): צריך כפתור ביטול שעובד מיד                                                         | [המועצה לצרכנות](https://www.consumers.org.il/category/discontinue-long-term-services), [נבו – החוק](https://www.nevo.co.il/law_html/law00/70305.htm)                                                                                                      |
| **בלי דמי ביטול**                                                              | לא גובים כלום על ביטול                                                                                                                      | [המועצה לצרכנות](https://www.consumers.org.il/category/discontinue-long-term-services)                                                                                                                                                                     |
| **ביטול באותה דרך שבה נרשמו** (כולל אינטרנט), ופירוט דרכי הביטול לפני ההתקשרות | במסך הרכישה ובתנאים: "ביטול בכל עת דרך Google Play ← מינויים". בפרופיל: קישור "ניהול המנוי"                                                 | [כל זכות – ביטול עסקה מתמשכת](https://www.kolzchut.org.il/he/%D7%91%D7%99%D7%98%D7%95%D7%9C_%D7%A2%D7%A1%D7%A7%D7%94_%D7%9E%D7%AA%D7%9E%D7%A9%D7%9B%D7%AA)                                                                                                 |
| **הטבה לתקופה מוגבלת** (למשל ניסיון חינם או מחיר מבצע)                         | ⚠️ לפי הבנתי, החוק מחייב הודעה לצרכן לפני שההטבה נגמרת והמחיר המלא מתחיל. לאמת את הנוסח המדויק. ‏Play שולחת תזכורות משלה, אבל באתר זה עלינו | [נבו](https://www.nevo.co.il/law_html/law00/70305.htm)                                                                                                                                                                                                     |
| **ביטול רכישה מרחוק תוך 14 יום** (סעיף 14ג)                                    | ⚠️ לא ברור איך זה חל על שירות דיגיטלי שכבר התחיל. ההמלצה: לכבד בקשת החזר בשבועיים הראשונים                                                  | [כל זכות – ביטול באינטרנט](https://www.kolzchut.org.il/he/%D7%91%D7%99%D7%98%D7%95%D7%9C_%D7%A2%D7%A1%D7%A7%D7%94_%D7%A9%D7%A0%D7%A2%D7%A9%D7%AA%D7%94_%D7%91%D7%90%D7%99%D7%A0%D7%98%D7%A8%D7%A0%D7%98_%D7%90%D7%95_%D7%91%D7%98%D7%9C%D7%A4%D7%95%D7%9F) |
| **פירוט חיובים שנתי** (מרס) בעסקה מתמשכת                                       | ⚠️ רלוונטי בעיקר למכירה ישירה באתר                                                                                                          | חיפוש בנוסח החוק                                                                                                                                                                                                                                           |

גם Google דורשת להציג בבירור לפני הרכישה את המחיר, התקופה, תנאי הניסיון ואיך מבטלים. ⚠️ זו מדיניות Subscriptions של Play, שלא קראתי ישירות.

### קטינים (13+) ורכישות

- לפי חוק הכשרות המשפטית, **פעולה משפטית של קטין (מתחת ל־18) טעונה הסכמת הורה**. ההסכמה יכולה להינתן מראש או בדיעבד ([המועצה לצרכנות דרך IAS](https://www.ias.co.il/?p=99487), [נוסח החוק](https://he.wikisource.org/wiki/%D7%97%D7%95%D7%A7_%D7%94%D7%9B%D7%A9%D7%A8%D7%95%D7%AA_%D7%94%D7%9E%D7%A9%D7%A4%D7%98%D7%99%D7%AA_%D7%95%D7%94%D7%90%D7%A4%D7%95%D7%98%D7%A8%D7%95%D7%A4%D7%A1%D7%95%D7%AA)). קיים חריג לעסקאות "מקובלות לבני גילו". ⚠️ מנוי חודשי של 20 ₪ כנראה גבולי.
- **בפועל ב־Play:** הקנייה משתמשת באמצעי התשלום בחשבון Google. אצל נער זה בדרך כלל כרטיס של הורה, או חשבון בפיקוח Family Link שבו ההורה יכול לדרוש אישור לכל רכישה ([Family Link help](https://support.google.com/families/answer/7101025)).
- **מה לעשות:**
  - במסך הרכישה: "מתחת לגיל 18? בקשו אישור מהורה לפני הרכישה".
  - בתנאי השימוש: רכישה על ידי קטין מחייבת הסכמת הורה, והורה יכול לבקש ביטול והחזר.
  - מדיניות החזרים נדיבה לבקשות של הורים.
  - בלי דפוסי לחץ ("רק היום!", טיימרים), כי הקהל צעיר.
  - בלי הצעות רכישה מתוך שיחת ה־AI עצמה.

### עדכונים לדפי הפרטיות והתנאים

**`public/terms.html`, סעיף חדש "מנוי פרימיום":**

- מה כלול (שיחות AI, עד 10 ביום) ושהמגבלות יכולות להשתנות.
- מחיר, תקופה, חידוש אוטומטי ותנאי הניסיון.
- איך מבטלים (Play ← מינויים, ובאתר: כפתור בפרופיל), ומה קורה בביטול: גישה עד סוף התקופה ששולמה.
- מדיניות החזרים, כולל 14 יום וקטינים.
- מחיקת החשבון **לא** מבטלת את המנוי ב־Google Play. צריך לבטל שם.
- זמינות השירות: ה־AI הוא שירות חיצוני, ואין התחייבות לזמינות מלאה.

**`public/privacy.html`:**

- נתונים חדשים: סטטוס מנוי, מזהה מוצר, תאריכי תפוגה, מזהה רכישה. לא פרטי כרטיס, כי הם נשארים אצל Google, Apple או Paddle.
- צדדים שלישיים חדשים: RevenueCat (מעבד נתוני רכישה, מקבל את מזהה המשתמש של Supabase), ‏Google Play, ובעתיד Apple ו־Paddle.
- תיקון 13 לחוק הגנת הפרטיות בתוקף מ־14.8.2025 ומחמיר את חובות השקיפות והאכיפה ([מיתר](https://meitar.com/wp-content/uploads/2025/02/In-honor-of-International-Data-Privacy-Day-%E2%80%93-Key-updates-in-the-field-of-privacy-in-Israel-HEB.pdf), [גולדפרב](https://www.goldfarb.com/he/%d7%a2%d7%93%d7%9b%d7%95%d7%9f-%d7%9c%d7%a7%d7%95%d7%97%d7%95%d7%aa-%d7%aa%d7%99%d7%a7%d7%95%d7%9f-%d7%9e%d7%a1-13-%d7%9c%d7%97%d7%95%d7%a7-%d7%94%d7%92%d7%a0%d7%aa-%d7%94%d7%a4%d7%a8%d7%98%d7%99/)).

**Play Console:**

- לעדכן את **Data safety**: ‏"Purchase history", שנאסף ומשותף עם RevenueCat כמעבד.
- לעדכן את תיאור החנות: "מכיל רכישות בתוך האפליקציה".

---

## 6. ארכיטקטורה מומלצת לאפליקציה

### העיקרון

**השרת מחליט מי פרימיום, לא הלקוח.** ‏`call-turn` כבר בודק פרימיום בצד השרת. משנים רק את מקור האמת: מרשימת אימיילים בסוד לטבלה ש־webhook מעדכן.

```
אפליקציה (Capacitor) ──Purchases.purchasePackage()──► Google Play
        │ Purchases.logIn(supabaseUserId)                   │ RTDN (Pub/Sub)
        ▼                                                   ▼
                       RevenueCat ◄─────────────────────────┘
                           │ webhook (Authorization: Bearer <סוד>)
                           ▼
        Supabase Edge Function: billing-webhook
           → GET RevenueCat /subscribers/{id} (מצב עדכני)
           → upsert public.entitlements (premium_until)
                           │
call-turn (Edge Function) ─┴─► is_premium(user) = premium_until > now()  OR  email ∈ PREMIUM_EMAILS
```

### טבלאות ב־Supabase (ממומש: `supabase/schema.sql`, סעיף 6)

> בפועל ללקוחות אין גישה גם לקריאת `entitlements`: האפליקציה מקבלת את `premiumUntil` ו־`willRenew` מהסטטוס של `call-turn`. ב־`billing_events` לא נשמר ה־user id.

```sql
-- (6) Premium entitlement, written only by the billing-webhook Edge Function (service role).
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  premium_until timestamptz,              -- null = never had premium
  source text check (source in ('play', 'app_store', 'web', 'manual')),
  product_id text,
  will_renew boolean,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
-- No client access at all; the app learns about premium from call-turn's status.
revoke all on public.entitlements from public, anon, authenticated;

-- Idempotency: each webhook event is processed once.
create table if not exists public.billing_events (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;
```

- **למה `premium_until` ולא `is_premium`:** כך לא צריך cron שיכבה את הדגל כשפג תוקף. אם webhook של חידוש התעכב, כדאי לתת מרווח קטן (למשל 24 שעות) בבדיקה.
- **מחיקת חשבון:** ‏`on delete cascade` מוחק את השורה. אבל המנוי ב־Google ממשיך, ולכן במסך המחיקה מציגים "יש לך מנוי פעיל. בטל אותו ב־Google Play". זה גם סעיף בתנאים.

### Edge Function חדשה: `billing-webhook`

1. **אימות:** משווים את ה־header ‏`Authorization` לסוד `REVENUECAT_WEBHOOK_SECRET` בהשוואה בזמן קבוע. אם לא תואם, מחזירים 401. מפרסמים עם `--no-verify-jwt`, כי RevenueCat לא שולחת JWT של Supabase.
2. **אידמפוטנטיות:** מכניסים את `event.id` ל־`billing_events`. אם הוא כבר קיים, מחזירים 200 בלי לעשות כלום.
3. **מצב עדכני:** לא סומכים על סדר ה־events. קוראים ל־RevenueCat REST API ‏(`GET /subscribers/{app_user_id}`, מפתח סודי `REVENUECAT_API_KEY`), ולוקחים את `entitlements.premium.expires_date`.
4. **כתיבה:** ‏upsert ל־`entitlements` עם service role.
5. **מחזירים 200 מהר.** ‏RevenueCat מנסה שוב עד 5 פעמים כשהתשובה לא 200 ([RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)).
6. **`TRANSFER`:** כשחשבון Google אחד עובר בין שני משתמשים שלנו, מעדכנים את שניהם. ב־RevenueCat כדאי לבחור את התנהגות ההעברה (Transfer behavior) במודע.
7. לא שומרים ולא מתעדים מידע אישי מעבר ל־user id וסוג האירוע.

### במה זה מחליף את `PREMIUM_EMAILS`

| מקום                                           | היום                             | אחרי                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/premium.ts`                            | `isPremium(email, set)`          | נשאר, ומשמש ל־**"manual"**: הבעלים, בודקים, מורים ומתנות. נוסיף `isEntitled(premiumUntil, now, graceMs)`, פונקציה טהורה שאפשר לבדוק                                                                                                                      |
| `supabase/functions/call-turn`                 | בודק אימייל מול `PREMIUM_EMAILS` | ‏`premium = isPremium(email) \|\| isEntitled(row?.premium_until)`. השורה נקראת עם service role, באותה קריאה כמו `increment_call_usage` או לפניה. אפשר לעטוף ב־RPC ‏`is_premium(p_user)`                                                                  |
| `GET call-turn` ‏(`CallStatusResponse`)        | `premium: boolean`               | אותו דבר. אפשר להוסיף `premiumUntil?: string` כדי להציג "בתוקף עד"                                                                                                                                                                                       |
| `server/src/routes/call.ts` (Express + SQLite) | `PREMIUM_EMAILS`                 | השרת משמש לאירוח עצמי ולפיתוח. האתר והאפליקציה עובדים מול Supabase. **ההמלצה:** להשאיר בו את ה־allowlist. אם יהיה צורך, להוסיף `POST /api/billing/revenuecat` שכותב לעמודה `premium_until` בטבלת `users` (מיגרציה חדשה ב־`server/src/db.ts`)             |
| לקוח (`src/lib/call-api.ts` וכו')              | מציג "רק למנויים" כשיש 403       | מסך מנוי (paywall) עם RevenueCat Offerings. ‏"שחזור רכישות" (`restorePurchases`). קישור "ניהול המנוי" ל־`https://play.google.com/store/account/subscriptions?sku=premium&package=com.baktana.english`. באתר: הודעה בלי כפתור קנייה (עד שתהיה מכירה באתר) |

**חשוב:** הלקוח לא מחליט אם יש פרימיום. הוא רק מציג. גם אם `CustomerInfo` של RevenueCat בלקוח אומר "פעיל", השרת בודק את הטבלה. בזמן שבין הקנייה ל־webhook (שניות) הלקוח יכול להציג "מפעילים את המנוי…" ולנסות שוב.

### תמחור מוצע וחישוב רווח

**הנחות:**

- עלות AI ‏0.005$ לשיחה (לפי הבעלים).
- דולר = 3.0 ₪. בספטמבר 2026 הדולר ירד אל מתחת ל־3 ₪ ([מאקו](https://www.mako.co.il/finances-news/stocks/Article-75a7b1672efad11006.htm)). ⚠️ לעדכן לשער היציג ביום ההחלטה.
- עמלת Google ‏15% מהמחיר לצרכן.
- תרחיש "מורשה": מע"מ 18% כלול במחיר ונגבה מאיתנו (התרחיש השמרני).
- תרחיש "פטור": אין מע"מ.

| מחיר לחודש     | עמלת Google | מע"מ (מורשה) | נטו – מורשה  | נטו – פטור | עלות AI, מקרה גרוע (300 שיחות) | רווח גרוע – מורשה |
| -------------- | ----------- | ------------ | ------------ | ---------- | ------------------------------ | ----------------- |
| 14.90 ₪        | 2.23 ₪      | 2.27 ₪       | 10.39 ₪      | 12.67 ₪    | 4.50 ₪                         | 5.89 ₪            |
| **19.90 ₪**    | 2.98 ₪      | 3.04 ₪       | **13.88 ₪**  | 16.91 ₪    | 4.50 ₪                         | **9.38 ₪**        |
| 24.90 ₪        | 3.73 ₪      | 3.80 ₪       | 17.37 ₪      | 21.16 ₪    | 4.50 ₪                         | 12.87 ₪           |
| **149 ₪ לשנה** | 22.35 ₪     | 22.73 ₪      | **103.92 ₪** | 126.65 ₪   | 54 ₪                           | 49.92 ₪           |

- **מקרה גרוע:** ‏10 שיחות × 30 יום × 0.005$ = 1.50$ ≈ 4.5 ₪ לחודש.
- **משתמש טיפוסי** (נניח 3 שיחות בשבוע, כ־13 בחודש): כ־0.065$ ≈ 0.20 ₪. כלומר כמעט כל ההכנסה נטו היא רווח.
- **ניסיון חינם של 7 ימים:** עלות מרבית של 70 × 0.005$ = 0.35$ ≈ 1 ₪ למשתמש. זול, וכדאי.
- **RevenueCat:** ‏0 ₪ עד כ־400 מנויים.
- **Supabase:** כל תור בשיחה הוא קריאה ל־Edge Function. בתוכנית החינמית יש 500,000 קריאות בחודש ([JetAdmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)). משתמש כבד (100 תורות ביום, התקרה בקוד) עלול לצרוך 3,000 קריאות בחודש. מעל כמה עשרות משתמשים כבדים צריך את Pro (‏25$ לחודש).

> **תקרת עלות:** `turnsPerDay` הורד ל־100 (בעבר 400). בהערכה של כ־0.0003–0.0005$ לתור, משתמש שמנצל את כל התקרה בכל יום עולה כ־1–1.5$ (‏3–4.5 ₪) לחודש.
> **המלצה:** למדוד עלות **לתור** (tokens in/out) במשך שבוע עם הבעלים והבודקים, ולעדכן את ההערכה.

**ההמלצה:** ‏**19.90 ₪ לחודש**, ‏**149 ₪ לשנה** (כ־38% הנחה, ומשאיר מרווח גם במקרה הגרוע), ו־**7 ימי ניסיון** למשתמשים חדשים. מחיר לבדיקה בהמשך: 24.90 ₪.

### תוכנית הטמעה, שלב אחרי שלב

> **איפה עצרנו (29 באוקטובר 2026):** ב־Play Console הושלמו פרופיל התשלומים, חשבון הבנק והמינוי `premium` (שתי התוכניות ו־`trial-7d`, הכול פעיל). ב־RevenueCat: אפליקציית Play עם ה־JSON של חשבון השירות (Valid credentials. לחשבון נוסף גם התפקיד Pub/Sub Admin בשביל ה־topic), ‏RTDN שמגיע ל־RevenueCat, ‏Entitlement ‏`premium` עם `premium:monthly` ו־`premium:yearly`, ‏Offering ‏`default` שבו `$rc_monthly` ו־`$rc_annual` מחוברים למוצרי Google Play, ו־webhook שעונה 200. ‏`REVENUECAT_API_KEY` ו־`REVENUECAT_WEBHOOK_SECRET` הוגדרו ב־GitHub Secrets. (ה־Entitlement ‏`baktana_english_pro` שנוצר לבד לא בשימוש.)
> **הצעד הבא:** ‏`VITE_REVENUECAT_ANDROID_KEY` (‏`goog_…`) ב־GitHub Variables ובנייה חדשה לבדיקה. לאשר את ההפקדה הקטנה בבנק, ולוודא ש־License testing מוגדר.

**שלב 0 – החלטות ורישום (הבעלים):**

- [ ] פגישה עם רואה חשבון: פטור או מורשה, מע"מ על Google, ניכוי במקור, פתיחת תיק
- [ ] פתיחת תיק במע"מ, במס הכנסה ובביטוח לאומי
- [ ] חשבון בנק (רצוי נפרד) שמקבל העברות מחו"ל
- [ ] לאשר מחיר ומשך ניסיון

**שלב 1 – Play Console:**

- [x] ‏Setup ← Payments profile: ליצור ולקשר (מדינה: ישראל, בנק ישראלי, כתובת פיזית). נוצר וקושר, חשבון הבנק נוסף (28.10.2026). **לאשר את ההפקדה הקטנה** כשתגיע
- [x] להעלות build עם Billing Library ‏(RevenueCat) למסלול **Internal testing**. מוצרים אפשר ליצור רק אחרי שהועלה build עם הרשאת BILLING
- [x] ‏Monetize ← Subscriptions: מוצר `premium`, ‏base plans `monthly` (19.90 ₪) ו־`yearly` (149 ₪), ‏offer `trial-7d` ל־new customers. הכול פעיל ב־175 מדינות (28.10.2026). הסימון "תאימות לאחור" על `monthly` הוא ברירת המחדל של Google, ולא משנה ל־RevenueCat
- [ ] ‏Setup ← License testing: להוסיף את חשבונות Gmail של הבעלים והבודקים (לוודא שנעשה)
- [x] ‏Google Cloud: ‏service account עם גישה ל־Play Developer API, הרשאות "View financial data" ו־"Manage orders and subscriptions". מעלים את ה־JSON ל־RevenueCat. **בתהליך:** פרויקט `baktana-billing`, חשבון `revenuecat@baktana-billing.iam.gserviceaccount.com`, ה־JSON הועלה. בבדיקה ב־RevenueCat שתי שורות עברו, ו־"Can validate Google Play subscription purchases" עדיין נכשלת (28.10.2026). לבדוק שוב: הרשאות החשבון ב־Play Console, ואחרי עד 36 שעות "Check credentials"
- [x] ‏Monetize ← Monetization setup ← RTDN: להזין את ה־topic ש־RevenueCat נותנת. לשלוח Test notification

**שלב 2 – RevenueCat:**

- [x] פרויקט חדש, אפליקציית Play ‏(`com.baktana.english` – ה־applicationId של flavor ‏`play`. ‏`com.baktana.english.sideload` הוא ה־APK להורדה)
- [x] ‏Entitlement ‏`premium` (בדיוק בשם הזה), וחיבור שני ה־base plans אליו. ‏Offering ‏`default` (מסומן Current) עם ה־packages המובנים **Monthly** ‏(`$rc_monthly`) ו־**Annual** ‏(`$rc_annual`): מסך המנוי מזהה את המסלולים לפי סוג ה־package
- [x] ‏Webhook: ה־URL של `billing-webhook` ו־Authorization header סודי. ‏Test event החזיר 200 (29.10.2026)
- [ ] מפתח Public SDK ‏(`goog_…`) ל־GitHub **Variables** בשם `VITE_REVENUECAT_ANDROID_KEY`. מפתח Secret API ‏(`sk_…`) ל־GitHub **Secrets** בשם `REVENUECAT_API_KEY`, ומחרוזת אקראית ל־Secrets בשם `REVENUECAT_WEBHOOK_SECRET`. ה־workflows מעבירים אותם לבד ל־Supabase ולבנייה ([supabase.md](supabase.md#מנוי-בתשלום-billing-webhook))

**שלב 3 – קוד (בוצע):**

- [x] `schema.sql`: הטבלאות `entitlements` ו־`billing_events`, עם בדיקות ב־`supabase/tests` (במקום RPC ‏`is_premium`, ‏`call-turn` קורא את השורה ישירות)
- [x] Edge Function ‏`billing-webhook`: אימות, אידמפוטנטיות, מצב עדכני מ־RevenueCat, ‏`TRANSFER` (שני הצדדים), משתמש שנמחק. הלוגיקה ב־`shared/billing.ts` עם בדיקות
- [x] `shared/premium.ts`: ‏`isEntitled` (עם יום חסד). ‏`call-turn`: ‏allowlist או entitlement, והסטטוס מחזיר `premiumUntil` ו־`willRenew`
- [x] `@revenuecat/purchases-capacitor` 13.7.4 ו־`cap sync`. ‏RevenueCat מופעל רק ב־flavor ‏`play` ורק כשיש `VITE_REVENUECAT_ANDROID_KEY` (`src/lib/billing.ts`)
- [x] ‏`logIn` עם ה־user id של Supabase אחרי התחברות, ו־`logOut` ביציאה
- [x] מסך מנוי (`src/components/Paywall.tsx`): מחירים מ־Offerings, ניסיון חינם, חיסכון בשנתי, תנאי חידוש וביטול, "שחזור רכישה", "ניהול המנוי", הודעה לקטינים, ו"מפעילים את המנוי…" עד שה־webhook מעדכן. נפתח מלשונית השיחות ומהפרופיל
- [x] בפרופיל: "מתחדש ב־…" / "בתוקף עד …". במחיקת חשבון: אזהרה שהמנוי ב־Google Play לא מתבטל
- [x] סעיפי מנוי ל־`terms.html` ול־`privacy.html`: טיוטה ב־[legal-premium-draft.md](legal-premium-draft.md), **לא מפורסמת**. לעבור עם עורך דין ולהחזיר לפני ההשקה
- [ ] תשובות Data safety ב־Play Console (הבעלים): ‏"Purchase history" נאסף, לא משותף, לצורך App functionality. ‏RevenueCat ו־Google מעבדים את הרכישה
- [x] תיעוד ב־`docs/supabase.md` (סודות חדשים: `REVENUECAT_WEBHOOK_SECRET`, ‏`REVENUECAT_API_KEY`)

**שלב 4 – בדיקות (license testers, ‏Internal testing):**

- [ ] רכישה עם כרטיס בדיקה. חודש מתחדש כל **5 דקות**, עד 6 חידושים. ניסיון: 3 דקות ([Test your integration](https://developer.android.com/google/play/billing/test))
- [ ] בדיקה ש־acknowledge קרה (בלי acknowledge, רכישת בדיקה מוחזרת אחרי 3 דקות)
- [ ] כרטיס "declines": מעבר ל־grace (5 דקות בבדיקה), ל־hold (10 דקות), ושלילת הגישה
- [ ] ביטול: גישה עד הסוף ואז `EXPIRATION`
- [ ] החזר מ־Console: ‏`REVOKED` ושלילה מיידית
- [ ] התקנה מחדש או מכשיר שני: "שחזור רכישות"
- [ ] שני חשבונות Supabase על אותו חשבון Google (`TRANSFER`)
- [ ] מחיקת חשבון עם מנוי פעיל
- [ ] ‏Play Billing Lab לבדיקת ניסיון חוזר ושינויי מחיר (אותו מקור)

**שלב 5 – השקה:**

- [ ] להחזיר את סעיפי המנוי לתנאים ולפרטיות ([legal-premium-draft.md](legal-premium-draft.md)), אחרי עורך דין
- [ ] להגדיר את `VITE_REVENUECAT_ANDROID_KEY` ב־GitHub Variables: זה מה ש"פותח את המכירה" באפליקציה ובאתר
- [ ] ‏Closed testing של 14 יום עם 12 בודקים (חובה בחשבון אישי, ‏[store-release.md](store-release.md))
- [ ] ‏Production. לעקוב בשבוע הראשון אחרי עלות AI לתור, אחוז ההמרה מניסיון, ושגיאות ב־webhook
- [ ] בהמשך: מכירה באתר (Paddle או סולק ישראלי), ואחר כך iOS עם אותו entitlement

---

## 7. מה צריך ממך (רק הבעלים יכול/ה)

1. **רואה חשבון:** לפתוח תיק עוסק (פטור או מורשה), ולקבל תשובה כתובה על מע"מ על מכירות דרך Google ללקוחות בישראל ועל ניכוי במקור.
2. **חשבון בנק** ישראלי על שמך (או של העסק) שמקבל העברות מחו"ל.
3. **Play Console:** ליצור payments profile ולקשר אותו. לאשר את הסכמי ה־Payments. להגדיר את חשבון הבנק. לפעמים מתבקש אימות זהות או מסמכים.
4. **Google Cloud:** ליצור service account ולתת לו הרשאות ב־Play Console (פעולה בממשק, 10 דקות. אפשר לעשות יחד לפי הוראות).
5. **RevenueCat:** להירשם (חינם), ליצור פרויקט, ולשים את המפתחות ב־GitHub (לא בצ'אט): ‏`VITE_REVENUECAT_ANDROID_KEY` ב־Variables, ‏`REVENUECAT_API_KEY` ו־`REVENUECAT_WEBHOOK_SECRET` ב־Secrets (פירוט בשלב 2).
6. **להחליט:** מחיר (מוצע 19.90 ₪ / 149 ₪), משך ניסיון (מוצע 7 ימים), ומדיניות החזרים.
7. **עורך דין** (מומלץ): לעבור על `terms.html` ו־`privacy.html` אחרי העדכון, במיוחד הסעיפים על מנוי, קטינים וביטול.
8. **לגייס 12 בודקים** לבדיקה הסגורה, אם עוד לא נעשה, ולהוסיף את עצמך ואת הבודקים כ־license testers.
9. **בעתיד:** חשבון Apple Developer ‏(99$ לשנה) והרשמה ל־Small Business Program. חשבון Paddle לאתר.

---

## דברים לא ודאיים (לבדוק שוב לפני ההשקה)

- ⚠️ מתי ואיך המבנה החדש של Google (10% ועוד 5%, ‏Billing Choice) יגיע לישראל. היעד המדווח: עד 30.9.2027.
- ⚠️ האם Google או Apple גובות ומעבירות מע"מ ישראלי, ואיך רשות המסים רואה הכנסה מ־Google על לקוחות ישראלים.
- ⚠️ האם Paddle ו־Lemon Squeezy מאשרות מוכר ישראלי ומעבירות כסף לבנק ישראלי.
- ⚠️ הנוסח המדויק של החובות בחוק הגנת הצרכן לגבי הטבה מוגבלת בזמן (ניסיון חינם) ולגבי ביטול תוך 14 יום בשירות דיגיטלי.
- ⚠️ עלות ה־AI לתור, לעומת ההנחה של 0.005$ לשיחה.
- ⚠️ האם ה־1% של RevenueCat מחושב על כל ההכנסה או רק על מה שמעל 2,500$.
