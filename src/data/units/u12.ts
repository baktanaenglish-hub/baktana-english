import type { Unit } from '../../types';

/**
 * Unit 12 (new in v2). Owner: content-b (see docs/spec/v2.md §5 and §10).
 * Lessons u12l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit12: Unit = {
  id: 'u12',
  title: "יחידה 12: טיול לחו״ל",
  description: "שדה תעופה, מלון, השוואות וחוקים",
  color: '#1864ab',
  level: 'A2',
  intro: {
    tip: "משווים עם [[er]] + [[than]]: [[bigger than]]; במילים ארוכות [[more]]: [[more expensive]] – ואף פעם לא [[more bigger]]. הכי: [[the biggest]], [[the best]]. ואחרי [[must]] לא בא [[to]]: [[You must stop]].",
    goals: ["להסתדר בשדה התעופה ובמלון", "להשוות דברים", "להבין חוקים ושלטים ולבקש עזרה"],
  },
  lessons: [
    {
      id: 'u12l1',
      title: 'בשדה התעופה',
      tip: 'מבקשים בנימוס עם [[Can I…?]] + פועל בסיס, בלי [[to]]: [[Can I see your passport?]]',
      words: [
        { en: 'airport', he: 'שדה תעופה', sound: 'אֶרְפּוֹרְט' },
        { en: 'passport', he: 'דרכון', sound: 'פָּסְפּוֹרְט' },
        { en: 'flight', he: 'טיסה', sound: 'פְלַייט' },
        { en: 'suitcase', he: 'מזוודה', sound: 'סוּטְקֵייס' },
        { en: 'gate', he: 'שער', sound: 'גֵייט' },
      ],
      sentences: [
        {
          en: 'Can I see your passport, please?',
          he: 'אפשר לראות את הדרכון שלך, בבקשה?',
          alt: ['Can I see your passport'],
          errors: ['E27'],
        },
        { en: 'My flight is at six', he: 'הטיסה שלי בשש', alt: ["My flight's at six"], errors: ['E1', 'E15'] },
        { en: 'Where is gate five?', he: 'איפה שער חמש?', alt: ["Where's gate five"], errors: ['E1'] },
        { en: 'This is my suitcase', he: 'זאת המזוודה שלי', errors: ['E1'] },
      ],
    },
    {
      id: 'u12l2',
      title: 'במלון',
      tip: "[[I'd like…]] היא הדרך המנומסת להגיד \"אני רוצה\": [[I'd like a room]]. קומה: [[on floor four]].",
      words: [
        { en: 'hotel', he: 'מלון', sound: 'הוֹטֶל' },
        { en: 'key', he: 'מפתח', sound: 'קִי' },
        { en: 'floor', he: 'קומה', sound: 'פְלוֹר' },
        { en: 'reservation', he: 'הזמנה', sound: 'רֶזֶרְבֵיישֶן' },
        { en: 'towel', he: 'מגבת', sound: 'טָאוּאֶל' },
      ],
      sentences: [
        {
          en: "I'd like a room for two nights",
          he: 'הייתי רוצה חדר לשני לילות',
          alt: ['I would like a room for two nights'],
          errors: ['E2', 'E10'],
        },
        { en: 'I have a reservation', he: 'יש לי הזמנה', errors: ['E2', 'E6'] },
        {
          en: 'The room is on floor four',
          he: 'החדר בקומה ארבע',
          alt: ["The room's on floor four", 'The room is on the fourth floor'],
          errors: ['E1', 'E15'],
        },
        { en: 'Here is your key', he: 'הנה המפתח שלך', alt: ["Here's your key"] },
      ],
    },
    {
      id: 'u12l3',
      title: 'יותר גדול מ…',
      tip: 'מילה קצרה מקבלת [[er]]: [[bigger than]]. מילה ארוכה מקבלת [[more]]: [[more expensive]]. אף פעם לא שניהם יחד – לא [[more better]].',
      words: [
        { en: 'new', he: 'חדש', sound: 'נְיוּ' },
        { en: 'old', he: 'ישן', sound: 'אוֹלְד' },
        { en: 'than', he: 'מאשר', sound: 'דֶ׳ן' },
        { en: 'better', he: 'יותר טוב', sound: 'בֶּטֶר' },
        { en: 'more', he: 'יותר', sound: 'מוֹר' },
      ],
      sentences: [
        {
          en: 'Tel Aviv is bigger than Haifa',
          he: 'תל אביב גדולה יותר מחיפה',
          alt: ["Tel Aviv's bigger than Haifa"],
          errors: ['E19'],
        },
        { en: 'The train is faster than the bus', he: 'הרכבת מהירה יותר מהאוטובוס', errors: ['E19'] },
        { en: 'This hotel is more expensive', he: 'המלון הזה יקר יותר', errors: ['E19'] },
        {
          en: 'My new phone is better',
          he: 'הטלפון החדש שלי יותר טוב',
          alt: ["My new phone's better"],
          errors: ['E4', 'E19'],
        },
      ],
    },
    {
      id: 'u12l4',
      title: 'הכי טוב',
      tip: 'הכי = [[the]] + [[est]]: [[the hottest]]. במילים ארוכות [[the most]]: [[the most beautiful]]. ו־[[good]] הופך ל־[[the best]].',
      words: [
        { en: 'best', he: 'הכי טוב', sound: 'בֶּסְט' },
        { en: 'most', he: 'הכי', sound: 'מוֹסְט' },
        { en: 'world', he: 'עולם', sound: 'וֶורְלְד' },
        { en: 'country', he: 'מדינה', sound: 'קָאנְטְרִי' },
        { en: 'beautiful', he: 'יפה', sound: 'בְּיוּטִיפוּל' },
      ],
      sentences: [
        { en: 'This is the best falafel in Israel', he: 'זה הפלאפל הכי טוב בישראל', errors: ['E19'] },
        {
          en: 'Eilat is the hottest city in Israel',
          he: 'אילת היא העיר הכי חמה בישראל',
          alt: ["Eilat's the hottest city in Israel"],
          errors: ['E19'],
        },
        {
          en: 'It is the most beautiful beach',
          he: 'זה החוף הכי יפה',
          alt: ["It's the most beautiful beach"],
          errors: ['E19'],
        },
        {
          en: 'What is the biggest country in the world?',
          he: 'מהי המדינה הכי גדולה בעולם?',
          alt: ["What's the biggest country in the world"],
          errors: ['E19'],
        },
      ],
    },
    {
      id: 'u12l5',
      title: 'חוקים ושלטים',
      tip: "אחרי [[must]] בא פועל בסיס, בלי [[to]]: [[You must stop]]. אסור = [[mustn't]]: [[You mustn't smoke]].",
      words: [
        { en: 'must', he: 'חייב', sound: 'מָאסְט' },
        { en: 'stop', he: 'לעצור', sound: 'סְטוֹפּ' },
        { en: 'smoke', he: 'לעשן', sound: 'סְמוֹק' },
        { en: 'quiet', he: 'שקט', sound: 'קְוַוייאֶט' },
        { en: 'sign', he: 'שלט', sound: 'סַיין' },
      ],
      sentences: [
        { en: 'You must stop here', he: 'אתה חייב לעצור כאן', heAlt: ['את חייבת לעצור כאן'], errors: ['E27'] },
        { en: "You mustn't smoke here", he: 'אסור לעשן כאן', alt: ['You must not smoke here'], errors: ['E27'] },
        { en: 'Be quiet, please', he: 'שקט, בבקשה', alt: ['Please be quiet'] },
        { en: 'What does this sign say?', he: 'מה כתוב בשלט הזה?', errors: ['E8', 'E14'] },
      ],
    },
    {
      id: 'u12l6',
      title: 'בעיה בטיול',
      tip: 'כשמשהו משתבש: [[I have a problem]], [[I lost my…]], [[I need help]]. באנגלית אומרים [[I lost my passport]] – עם [[my]], לא [[the]].',
      words: [
        { en: 'problem', he: 'בעיה', sound: 'פְּרוֹבְּלֶם' },
        { en: 'lost', he: 'אבוד', sound: 'לוֹסְט' },
        { en: 'police', he: 'משטרה', sound: 'פּוֹלִיס' },
        { en: 'need', he: 'צריך', sound: 'נִיד' },
        { en: 'card', he: 'כרטיס אשראי', sound: 'קָארְד' },
      ],
      sentences: [
        { en: 'I have a problem', he: 'יש לי בעיה', errors: ['E2', 'E6'] },
        { en: 'I lost my passport', he: 'איבדתי את הדרכון שלי', errors: ['E3'] },
        {
          en: 'I need help, please',
          he: 'אני צריך עזרה, בבקשה',
          alt: ['Please, I need help'],
          heAlt: ['אני צריכה עזרה, בבקשה'],
        },
        {
          en: 'Can I pay by card?',
          he: 'אפשר לשלם בכרטיס?',
          alt: ['Can I pay with a card', 'Can I pay by credit card'],
          errors: ['E3'],
        },
      ],
    },
  ],
};
