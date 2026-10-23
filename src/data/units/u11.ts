import type { Unit } from '../../types';

/**
 * Unit 11 (new in v2). Owner: content-b (see docs/spec/v2.md §5 and §10).
 * Lessons u11l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit11: Unit = {
  id: 'u11',
  title: "יחידה 11: סיפורים ותוכניות",
  description: "עבר לא רגיל, סוף שבוע, תוכניות והזמנות",
  color: '#2f9e44',
  level: 'A2',
  intro: {
    tip: "סיפור מחברים עם [[first]], [[then]], [[after that]]. תוכנית שכבר החלטנו עליה: [[I am going to…]]. החלטה של הרגע או הבטחה: [[I'll help you]] – ואחרי [[will]] לא בא [[to]].",
    goals: ["לספר סיפור קצר על סוף השבוע", "לדבר על תוכניות", "להזמין ולהיענות להזמנה"],
  },
  lessons: [
    {
      id: 'u11l1',
      title: 'קניתי, באתי, הכנתי',
      tip: 'עוד פעלים עם עבר מיוחד: [[buy → bought]], [[come → came]], [[make → made]], [[give → gave]], [[tell → told]].',
      words: [
        { en: 'bought', he: 'קנה', sound: 'בּוֹט' },
        { en: 'came', he: 'בא', sound: 'קֵיים' },
        { en: 'made', he: 'הכין', sound: 'מֵייד' },
        { en: 'gave', he: 'נתן', sound: 'גֵייב' },
        { en: 'told', he: 'סיפר', sound: 'טוֹלְד' },
      ],
      sentences: [
        { en: 'I bought new shoes', he: 'קניתי נעליים חדשות', errors: ['E4'] },
        { en: 'My friends came to my party', he: 'החברים שלי באו למסיבה שלי' },
        { en: 'Dad made dinner', he: 'אבא הכין ארוחת ערב', alt: ['My dad made dinner'] },
        { en: 'She told me a story', he: 'היא סיפרה לי סיפור', errors: ['E2'] },
      ],
    },
    {
      id: 'u11l2',
      title: 'סוף השבוע שלי',
      tip: 'מספרים לפי הסדר: [[first]] (קודם), [[then]] (ואז), [[after that]] (אחרי זה). כל הפעלים בסיפור בעבר.',
      words: [
        { en: 'first', he: 'קודם', sound: 'פֶרְסְט' },
        { en: 'then', he: 'ואז', sound: 'דֶ׳ן' },
        { en: 'after', he: 'אחרי', sound: 'אַפְטֶר' },
        { en: 'grandma', he: 'סבתא', sound: 'גְרֶנְמָה' },
        { en: 'trip', he: 'טיול', sound: 'טְרִיפּ' },
      ],
      sentences: [
        {
          en: 'Last weekend we went to the beach',
          he: 'בסוף השבוע שעבר הלכנו לים',
          alt: ['We went to the beach last weekend'],
          errors: ['E3'],
        },
        { en: 'First we ate, then we swam', he: 'קודם אכלנו, ואז שחינו', alt: ['First we ate and then we swam'] },
        {
          en: 'After that, we visited grandma',
          he: 'אחרי זה ביקרנו את סבתא',
          alt: ['After that we visited our grandma', 'After that we visited my grandma'],
          errors: ['E20'],
        },
        { en: 'It was a good trip', he: 'זה היה טיול טוב', errors: ['E2', 'E4'] },
      ],
    },
    {
      id: 'u11l3',
      title: 'מה התוכניות?',
      tip: 'תוכנית שכבר החלטנו עליה: [[am / is / are]] + [[going to]] + פועל: [[I am going to visit]]. בלי [[am]] זה לא עובד.',
      words: [
        { en: 'plan', he: 'תוכנית', sound: 'פְּלֶן' },
        { en: 'next', he: 'הבא', sound: 'נֶקְסְט' },
        { en: 'summer', he: 'קיץ', sound: 'סָאמֶר' },
        { en: 'vacation', he: 'חופשה', sound: 'וֵיקֵיישֶן' },
        { en: 'abroad', he: 'לחו״ל', sound: 'אַבְּרוֹד' },
      ],
      sentences: [
        {
          en: 'I am going to visit my grandma',
          he: 'אני הולך לבקר את סבתא שלי',
          alt: ["I'm going to visit my grandma"],
          heAlt: ['אני הולכת לבקר את סבתא שלי'],
          errors: ['E1'],
        },
        {
          en: 'We are going abroad next summer',
          he: 'אנחנו נוסעים לחו״ל בקיץ הבא',
          alt: ["We're going abroad next summer"],
          errors: ['E1'],
        },
        {
          en: 'What are you going to do?',
          he: 'מה אתה הולך לעשות?',
          heAlt: ['מה את הולכת לעשות?'],
          errors: ['E1', 'E14'],
        },
        {
          en: 'Do you have plans for the vacation?',
          he: 'יש לך תוכניות לחופשה?',
          alt: ['Do you have any plans for the vacation', 'Do you have plans for the holiday'],
          errors: ['E6', 'E8'],
        },
      ],
    },
    {
      id: 'u11l4',
      title: 'אני אעזור לך',
      tip: "אחרי [[will]] בא פועל בסיס, בלי [[to]]: [[I'll help you]]. ובעברית \"אני חושב ש…\" – באנגלית אפשר בלי [[that]]: [[I think it will rain]].",
      words: [
        { en: 'maybe', he: 'אולי', sound: 'מֵייבִּי' },
        { en: 'think', he: 'לחשוב', sound: 'ת׳ינְק' },
        { en: 'sure', he: 'בטח', sound: 'שוּר' },
        { en: 'window', he: 'חלון', sound: 'וִינְדוֹ' },
        { en: 'promise', he: 'להבטיח', sound: 'פְּרוֹמִיס' },
      ],
      sentences: [
        { en: 'I will help you', he: 'אני אעזור לך', alt: ["I'll help you"], errors: ['E27'] },
        {
          en: 'I think it will rain',
          he: 'אני חושב שירד גשם',
          alt: ["I think it'll rain", 'I think that it will rain'],
          heAlt: ['אני חושבת שירד גשם'],
          errors: ['E22'],
        },
        { en: "I'll open the window", he: 'אני אפתח את החלון', alt: ['I will open the window'], errors: ['E27'] },
        { en: 'Sure, I promise', he: 'בטח, אני מבטיח', heAlt: ['בטח, אני מבטיחה'] },
      ],
    },
    {
      id: 'u11l5',
      title: 'בואו נצא',
      tip: "מזמינים: [[Do you want to…?]] או [[Let's…]]. מקבלים: [[I'd love to]]. מסרבים בנימוס: [[Sorry, I can't]].",
      words: [
        { en: 'want', he: 'לרצות', sound: 'וָונְט' },
        { en: 'invite', he: 'להזמין', sound: 'אִינְוַייט' },
        { en: 'join', he: 'להצטרף', sound: 'ג׳וֹין' },
        { en: "let's", he: 'בואו', sound: 'לֶטְס' },
        { en: 'cinema', he: 'קולנוע', sound: 'סִינֶמָה' },
      ],
      sentences: [
        {
          en: 'Do you want to come to my party?',
          he: 'אתה רוצה לבוא למסיבה שלי?',
          heAlt: ['את רוצה לבוא למסיבה שלי?'],
          errors: ['E8', 'E22'],
        },
        { en: "I'd love to", he: 'בשמחה', alt: ['I would love to'] },
        {
          en: "Sorry, I can't. I'm busy",
          he: 'מצטער, אני לא יכול. אני עסוק',
          alt: ['Sorry, I cannot. I am busy', "Sorry, I can't, I'm busy", "Sorry, I can't. I am busy"],
          heAlt: ['מצטערת, אני לא יכולה. אני עסוקה'],
          errors: ['E1'],
        },
        {
          en: "Let's go to the cinema",
          he: 'בואו נלך לקולנוע',
          alt: ["Let's go to the movies", 'Let us go to the cinema'],
          errors: ['E3'],
        },
      ],
    },
  ],
};
