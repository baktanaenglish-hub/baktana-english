import type { Unit } from '../../types';

/**
 * Unit 8 (new in v2). Owner: content-a (see docs/spec/v2.md §5 and §10).
 * Lessons u8l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit8: Unit = {
  id: 'u8',
  title: "יחידה 8: מה קורה עכשיו?",
  description: "הווה מתמשך, בגדים, מזג אוויר וטלפון",
  color: '#e85d9b',
  level: 'A1+',
  intro: {
    tip: "מה שקורה עכשיו: [[am / is / are]] + פועל עם [[ing]] – [[I am reading]]. מה שקורה בדרך כלל: הווה פשוט – [[I read every day]]. בעברית יש הווה אחד, באנגלית שניים. מזג אוויר מתחיל ב־[[It]]: [[It is hot]].",
    goals: ["לתאר מה קורה עכשיו", "לדבר על בגדים ומזג אוויר", "להסתדר בשיחת טלפון"],
  },
  lessons: [
    {
      id: 'u8l1',
      title: 'מה קורה עכשיו?',
      tip: 'מה שקורה ברגע זה: [[am / is / are]] + פועל עם [[ing]]. אומרים [[I am reading]], לא [[I reading]].',
      words: [
        { en: 'now', he: 'עכשיו', sound: 'נָאוּ' },
        { en: 'write', he: 'לכתוב', sound: 'רַייט' },
        { en: 'listen', he: 'להקשיב', sound: 'לִיסֶן' },
        { en: 'wait', he: 'לחכות', sound: 'וֵויט' },
        { en: 'study', he: 'ללמוד', sound: 'סְטָאדִי' },
      ],
      sentences: [
        { en: 'I am reading now', he: 'אני קורא עכשיו', alt: ["I'm reading now"], heAlt: ['אני קוראת עכשיו'], errors: ['E1', 'E17'] },
        { en: 'She is studying English', he: 'היא לומדת אנגלית', alt: ["She's studying English"], errors: ['E1'] },
        { en: 'We are waiting for the bus', he: 'אנחנו מחכים לאוטובוס', alt: ["We're waiting for the bus"], errors: ['E1'] },
        { en: 'Are you listening?', he: 'אתה מקשיב?', heAlt: ['את מקשיבה?'], errors: ['E1', 'E8'] },
      ],
    },
    {
      id: 'u8l2',
      title: 'מה אתה עושה?',
      words: [
        { en: 'phone', he: 'טלפון', sound: 'פוֹן' },
        { en: 'talk', he: 'לשוחח', sound: 'טוֹק' },
        { en: 'message', he: 'הודעה', sound: 'מֶסֶג׳' },
        { en: 'send', he: 'לשלוח', sound: 'סֶנְד' },
        { en: 'game', he: 'משחק', sound: 'גֵיים' },
      ],
      sentences: [
        { en: 'What are you doing?', he: 'מה אתה עושה?', heAlt: ['מה את עושה?'], errors: ['E1', 'E14'] },
        {
          en: 'I am sending a message',
          he: 'אני שולח הודעה',
          alt: ["I'm sending a message"],
          heAlt: ['אני שולחת הודעה'],
          errors: ['E1', 'E2'],
        },
        { en: 'He is talking on the phone', he: 'הוא מדבר בטלפון', alt: ["He's talking on the phone"], errors: ['E1', 'E15'] },
        { en: 'They are playing a game', he: 'הם משחקים משחק', alt: ["They're playing a game"], errors: ['E1', 'E2'] },
      ],
    },
    {
      id: 'u8l3',
      title: 'בגדים',
      words: [
        { en: 'shirt', he: 'חולצה', sound: 'שֶרְט' },
        { en: 'shoes', he: 'נעליים', sound: 'שוּז' },
        { en: 'coat', he: 'מעיל', sound: 'קוֹט' },
        { en: 'jeans', he: 'ג׳ינס', sound: 'ג׳ינְס' },
        { en: 'wear', he: 'ללבוש', sound: 'וֶור' },
      ],
      sentences: [
        {
          en: 'I am wearing a blue shirt',
          he: 'אני לובש חולצה כחולה',
          alt: ["I'm wearing a blue shirt"],
          heAlt: ['אני לובשת חולצה כחולה'],
          errors: ['E1', 'E4'],
        },
        { en: 'Where are my shoes?', he: 'איפה הנעליים שלי?', errors: ['E1'] },
        { en: 'She is wearing jeans', he: 'היא לובשת ג׳ינס', alt: ["She's wearing jeans"], errors: ['E1'] },
        { en: 'Is this your coat?', he: 'זה המעיל שלך?', errors: ['E8'] },
      ],
    },
    {
      id: 'u8l4',
      title: 'מזג האוויר',
      tip: 'באנגלית למשפט חייב להיות נושא, גם כשבעברית אין: ״חם היום״ = [[It is hot today]].',
      words: [
        { en: 'hot', he: 'חם', sound: 'הוֹט' },
        { en: 'cold', he: 'קר', sound: 'קוֹלְד' },
        { en: 'rain', he: 'גשם', sound: 'רֵיין' },
        { en: 'sunny', he: 'שמשי', sound: 'סָאנִי' },
        { en: 'today', he: 'היום', sound: 'טוּדֵיי' },
      ],
      sentences: [
        { en: 'It is hot today', he: 'חם היום', alt: ["It's hot today"], errors: ['E1'] },
        { en: 'It is raining', he: 'יורד גשם', alt: ["It's raining"], errors: ['E1', 'E17'] },
        { en: 'Is it cold outside?', he: 'קר בחוץ?', alt: ['Is it cold out'], errors: ['E1', 'E8'] },
        { en: 'It is sunny in Eilat', he: 'יש שמש באילת', alt: ["It's sunny in Eilat"], errors: ['E1'] },
      ],
    },
    {
      id: 'u8l5',
      title: 'בדרך כלל או עכשיו?',
      tip: 'הרגל (בדרך כלל): [[She speaks fast]]. משהו שקורה היום או עכשיו: [[Today I am taking the bus]].',
      words: [
        { en: 'but', he: 'אבל', sound: 'בָּאט' },
        { en: 'tonight', he: 'הערב', sound: 'טוּנַייט' },
        { en: 'together', he: 'ביחד', sound: 'טוּגֶדֶ׳ר' },
        { en: 'fast', he: 'מהר', sound: 'פֶאסְט' },
        { en: 'slow', he: 'איטי', sound: 'סְלוֹ' },
      ],
      sentences: [
        {
          en: 'Today I am taking the bus',
          he: 'היום אני נוסע באוטובוס',
          alt: ["Today I'm taking the bus", 'I am taking the bus today', "I'm taking the bus today"],
          heAlt: ['היום אני נוסעת באוטובוס'],
          errors: ['E17'],
        },
        {
          en: 'We are eating together tonight',
          he: 'אנחנו אוכלים ביחד הערב',
          alt: ["We're eating together tonight"],
          errors: ['E17'],
        },
        { en: 'She speaks fast', he: 'היא מדברת מהר', errors: ['E7'] },
        { en: 'The bus is slow', he: 'האוטובוס איטי', errors: ['E1'] },
      ],
    },
    {
      id: 'u8l6',
      title: 'בטלפון',
      words: [
        { en: 'call', he: 'להתקשר', sound: 'קוֹל' },
        { en: 'back', he: 'בחזרה', sound: 'בֶּק' },
        { en: 'way', he: 'דרך', sound: 'וֵויי' },
        { en: 'later', he: 'אחר כך', sound: 'לֵייטֶר' },
        { en: 'number', he: 'מספר', sound: 'נָאמְבֶּר' },
      ],
      sentences: [
        { en: 'I am on my way', he: 'אני בדרך', alt: ["I'm on my way"], errors: ['E1'] },
        { en: 'Can you call me back?', he: 'אתה יכול לחזור אליי?', heAlt: ['את יכולה לחזור אליי?'], errors: ['E27'] },
        { en: 'Call me later', he: 'תתקשר אליי אחר כך', alt: ['Call me back later'], heAlt: ['תתקשרי אליי אחר כך'] },
        { en: 'What is your phone number?', he: 'מה מספר הטלפון שלך?', alt: ["What's your phone number"], errors: ['E1', 'E14'] },
      ],
    },
  ],
};
