# הנחיות ל־Claude

- **שפה:** עונים לבעלת הפרויקט תמיד בעברית – כל הודעה, כל סיכום וכל שאלה, גם אחרי עבודה ארוכה או התראות אוטומטיות (CI, תזכורות). אנגלית רק כשהיא מבקשת את זה במפורש. קוד, הודעות commit והערות בקוד נשארים באנגלית, כמו בשאר הריפו.
- טקסט שמוצג למשתמשים באפליקציה – בעברית (ראו CONTRIBUTING.md).

## שינויי UI – קודם מחפשים במקורות האלה

לפני שבונים מאפס רכיב, אנימציה, אייקון או מסך, מחפשים פתרון מוכן או השראה במקורות שבעלת הפרויקט בחרה. כך חוסכים זמן ושומרים על רמה אחידה.

**התאמה לפרויקט:** האפליקציה כתובה ב־React 19 עם Vite ו־CSS רגיל (`src/styles.css`, משתני צבע ב־`:root`, מצב כהה). היא מימין לשמאל, ורצה גם כאפליקציית אנדרואיד דרך Capacitor. אין Tailwind. לכן:

- מעדיפים להעתיק ולהתאים קוד HTML/CSS או רעיון, ולא להוסיף ספרייה כבדה.
- ספריות שמבוססות על Tailwind (shadcn, Flowbite, Preline, Magic UI, HeroUI, Float UI) משמשות כהשראה למבנה ולהתנהגות. את העיצוב כותבים מחדש ב־CSS של הפרויקט.
- תלות חדשה מוסיפים רק כשהיא קטנה ומצדיקה את עצמה, וכותבים ב־PR למה.
- כל מה שמעתיקים מתאימים ל־RTL, למשתני הצבע ולמצב הכהה. גם הנגישות נשמרת: תוויות בעברית, יעד לחיצה של 44px לפחות, ו־`prefers-reduced-motion`.
- בודקים שהרישיון מתיר שימוש.

**ריכוז Skills:** https://www.ui-skills.com

**ספריות UI וקומפוננטות:** https://spell.sh · https://21st.dev · https://heroui.com · https://preline.co · https://mantine.dev · https://ant.design · https://floatui.com · https://flowbite.com · https://ui.shadcn.com · https://magicui.design · https://www.originui-ng.com

**אנימציות, אפקטים ווידאו:** https://gsap.com · https://motion.dev · https://animejs.com · https://shaders.com · https://jitter.video · https://www.swishy.ai · https://lottiefiles.com · https://animmasterlib.dev
(לאנימציות קטנות מעדיפים CSS. ל־Lottie או ל־Motion פונים רק כשיש צורך אמיתי.)

**השראה, אייקונים וכלים נוספים:** https://ui.live · https://uiverse.io (רכיבי HTML/CSS שמתאימים לפרויקט בלי שינוי גדול) · https://iconsax.io · https://lucide.dev · https://phosphoricons.com (אייקונים במקום אימוג'י כשצריך) · https://mobbin.com (מסכים של אפליקציות אמיתיות, למשל Duolingo) · https://landings.dev · https://recent.design · https://www.dark.design · https://www.ripplix.com · https://designspells.com

**מערכות עיצוב:** https://m3.material.io (מתאים במיוחד לאנדרואיד) · https://open-ui.org/design-systems · https://open-design.ai/plugins/systems · https://github.com/mjmirza/apple-design-system

בסיכום של כל שינוי UI מציינים מאיזה מקור נלקח הרעיון או הקוד, אם נלקח.
