import type { Unit } from '../../types';

/** Unit 14 (added after v2): technology and the internet. Same rules as the other units (see README.md). */
export const unit14: Unit = {
  id: 'u14',
  title: 'יחידה 14: טכנולוגיה ואינטרנט',
  description: 'מחשב, אפליקציות, רשתות חברתיות וקניות אונליין',
  color: '#862e9c',
  level: 'A2',
  intro: {
    tip: 'באנגלית לא "פותחים" ו"סוגרים" את האור או את המכשיר: מדליקים [[turn on]] ומכבים [[turn off]]. [[Turn on the phone]], לא [[open the phone]]. ובאינטרנט אומרים [[on the internet]].',
    goals: ['לדבר על מחשב, טלפון ואינטרנט', 'להשתמש באפליקציות ובסיסמאות', 'להסביר שיש תקלה ולקנות אונליין'],
  },
  lessons: [
    {
      id: 'u14l1',
      title: 'מחשב ואינטרנט',
      tip: 'באינטרנט אומרים [[on the internet]] ו־[[on the website]]. מחשב נייד הוא [[laptop]].',
      words: [
        { en: 'internet', he: 'אינטרנט', sound: 'אִינְטֶרְנֶט' },
        { en: 'website', he: 'אתר', sound: 'וֶוּבְּסַייט' },
        { en: 'laptop', he: 'מחשב נייד', sound: 'לַפְּטוֹפּ' },
        { en: 'screen', he: 'מסך', sound: 'סְקְרִין' },
        { en: 'battery', he: 'סוללה', sound: 'בַּטֶרִי' },
      ],
      sentences: [
        { en: 'I use the internet every day', he: 'אני משתמש באינטרנט כל יום', heAlt: ['אני משתמשת באינטרנט כל יום'], errors: ['E3'] },
        { en: 'This website is good', he: 'האתר הזה טוב', errors: ['E1'] },
        { en: 'My laptop is new', he: 'המחשב הנייד שלי חדש', alt: ["My laptop's new"], errors: ['E1'] },
        { en: 'The screen is big', he: 'המסך גדול', alt: ["The screen's big"], errors: ['E1'] },
      ],
    },
    {
      id: 'u14l2',
      title: 'אפליקציות וסיסמאות',
      tip: 'את הסיסמה לא מגלים: [[Do not share your password]]. אפליקציה מורידים עם [[download]] ומעדכנים עם [[update]].',
      words: [
        { en: 'app', he: 'אפליקציה', sound: 'אַפּ' },
        { en: 'download', he: 'להוריד', sound: 'דַאוּנְלוֹד' },
        { en: 'update', he: 'עדכון', sound: 'אַפְּדֵייט' },
        { en: 'password', he: 'סיסמה', sound: 'פַּסְוֶורְד' },
        { en: 'account', he: 'חשבון', sound: 'אַקַאוּנְט' },
      ],
      sentences: [
        { en: 'I download an app', he: 'אני מוריד אפליקציה', heAlt: ['אני מורידה אפליקציה'], errors: ['E2'] },
        { en: 'This app needs an update', he: 'האפליקציה הזאת צריכה עדכון', errors: ['E2', 'E7'] },
        { en: 'What is your password?', he: 'מה הסיסמה שלך?', alt: ["What's your password"], errors: ['E1', 'E14'] },
        { en: 'I have an account', he: 'יש לי חשבון', errors: ['E2', 'E6'] },
      ],
    },
    {
      id: 'u14l3',
      title: 'רשתות חברתיות',
      tip: 'משתפים תמונה עם [[share]]: [[I share a photo]]. תמונה היא [[photo]]. מצלמים: [[take a photo]]. תמונה של...: [[a photo of my family]].',
      words: [
        { en: 'photo', he: 'תמונה', sound: 'פוֹטוֹ' },
        { en: 'video', he: 'סרטון', sound: 'וִידֵיאוֹ' },
        { en: 'share', he: 'לשתף', sound: 'שֵׁר' },
        { en: 'post', he: 'פוסט', sound: 'פּוֹסְט' },
        { en: 'follow', he: 'לעקוב', sound: 'פוֹלוֹ' },
      ],
      sentences: [
        { en: 'I share a photo', he: 'אני משתף תמונה', heAlt: ['אני משתפת תמונה'], errors: ['E2'] },
        { en: 'This video is funny', he: 'הסרטון הזה מצחיק', errors: ['E1'] },
        { en: 'She likes my post', he: 'היא אוהבת את הפוסט שלי', errors: ['E7'] },
        { en: 'I follow my friends', he: 'אני עוקב אחרי החברים שלי', heAlt: ['אני עוקבת אחרי החברים שלי'] },
      ],
    },
    {
      id: 'u14l4',
      title: 'תקלה בטלפון',
      tip: 'לא [[open the light]] אלא [[turn on the light]]; ולא [[close the phone]] אלא [[turn off the phone]]. מדליקים [[turn on]], מכבים [[turn off]].',
      words: [
        { en: 'broken', he: 'שבור', sound: 'בְּרוֹקֶן' },
        { en: 'turn on', he: 'להדליק', sound: 'טֶרְן אוֹן' },
        { en: 'turn off', he: 'לכבות', sound: 'טֶרְן אוֹף' },
        { en: 'Wi-Fi', he: 'ווייפיי', sound: 'וַוייפַיי' },
        { en: 'charge', he: 'להטעין', sound: 'צ׳ָארְג׳' },
      ],
      sentences: [
        { en: 'My phone is broken', he: 'הטלפון שלי שבור', alt: ["My phone's broken"], errors: ['E1'] },
        { en: 'Please turn on the computer', he: 'בבקשה תדליק את המחשב', heAlt: ['בבקשה תדליקי את המחשב'], errors: ['E24'] },
        { en: 'Turn off the TV, please', he: 'תכבה את הטלוויזיה, בבקשה', heAlt: ['תכבי את הטלוויזיה, בבקשה'], alt: ['Please turn off the TV'], errors: ['E24'] },
        { en: 'Is there Wi-Fi here?', he: 'יש כאן ווייפיי?', alt: ['Is there Wi-Fi'], errors: ['E6'] },
      ],
    },
    {
      id: 'u14l5',
      title: 'קניות אונליין',
      tip: 'משלוח הוא [[delivery]]: [[free delivery]]. ומזמינים מוצר עם [[order]]: [[I order a bag]]. הנחה היא [[a discount]].',
      words: [
        { en: 'order', he: 'לבצע הזמנה', sound: 'אוֹרְדֶר' },
        { en: 'delivery', he: 'משלוח', sound: 'דִילִיבֶרִי' },
        { en: 'discount', he: 'הנחה', sound: 'דִיסְקַאוּנְט' },
        { en: 'return', he: 'להחזיר', sound: 'רִיטֶרְן' },
        { en: 'review', he: 'ביקורת', sound: 'רִיוְיוּ' },
      ],
      sentences: [
        { en: 'I order a bag online', he: 'אני מזמין תיק באינטרנט', heAlt: ['אני מזמינה תיק באינטרנט'], errors: ['E2'] },
        { en: 'The delivery is free', he: 'המשלוח חינם', alt: ["The delivery's free"], errors: ['E1'] },
        { en: 'There is a discount', he: 'יש הנחה', alt: ["There's a discount"], errors: ['E2', 'E6'] },
        { en: 'Can I return it?', he: 'אפשר להחזיר את זה?', alt: ['Can I return this'], errors: ['E27'] },
      ],
    },
  ],
};
