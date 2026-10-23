import type { Unit } from '../../types';

/**
 * Unit 5. Owner: content-b (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit5: Unit = {
  id: 'u5',
  title: 'יחידה 5: בבית ובשגרה',
  description: 'הבית שלי ומה אני עושה כל יום',
  color: '#ff4b4b',
  level: 'A1',
  intro: {
    tip: "על שגרה מדברים בהווה פשוט: [[I get up at seven]]. מילים כמו [[always]], [[usually]], [[never]] באות לפני הפועל, ואחרי [[never]] לא מוסיפים [[don't]].",
    goals: ["לתאר את הבית", "לספר על סדר היום", "להגיד כמה פעמים אני עושה משהו"],
  },
  lessons: [
    {
      id: 'u5l1',
      title: 'הבית שלי',
      words: [
        { en: 'house', he: 'בית', sound: 'הָאוּס' },
        { en: 'room', he: 'חדר', sound: 'רוּם' },
        { en: 'table', he: 'שולחן', sound: 'טֵייבּל' },
        { en: 'bed', he: 'מיטה', sound: 'בֶּד' },
        { en: 'door', he: 'דלת', sound: 'דוֹר' },
      ],
      sentences: [
        { en: 'This is my house', he: 'זה הבית שלי', alt: ['This is my home'], errors: ['E1'] },
        { en: 'The door is open', he: 'הדלת פתוחה', alt: ["The door's open"], errors: ['E1'] },
        { en: 'The bed is in the room', he: 'המיטה בחדר', alt: ["The bed's in the room"], errors: ['E1', 'E3'] },
        {
          en: 'There is a table in the room',
          he: 'יש שולחן בחדר',
          alt: ["There's a table in the room"],
          errors: ['E2', 'E6'],
        },
      ],
    },
    {
      id: 'u5l2',
      title: 'בוקר טוב',
      words: [
        { en: 'morning', he: 'בוקר', sound: 'מוֹרנִינג' },
        { en: 'night', he: 'לילה', sound: 'נַייט' },
        { en: 'work', he: 'עבודה', sound: 'ווֹרק' },
        { en: 'school', he: 'בית ספר', sound: 'סקוּל' },
        { en: 'sleep', he: 'לישון', sound: 'סלִיפּ' },
      ],
      sentences: [
        { en: 'Good morning', he: 'בוקר טוב' },
        { en: 'I go to school', he: 'אני הולך לבית הספר', heAlt: ['אני הולכת לבית הספר'], errors: ['E3'] },
        { en: 'I sleep at night', he: 'אני ישן בלילה', heAlt: ['אני ישנה בלילה'], errors: ['E15'] },
        { en: 'I work in the morning', he: 'אני עובד בבוקר', heAlt: ['אני עובדת בבוקר'], errors: ['E15'] },
      ],
    },
    {
      id: 'u5l3',
      title: 'כל יום',
      words: [
        { en: 'always', he: 'תמיד', sound: 'אוֹלוֵייז' },
        { en: 'never', he: 'אף פעם', sound: 'נֶבֶר' },
        { en: 'every', he: 'כל', sound: 'אֶבְרִי' },
        { en: 'day', he: 'יום', sound: 'דֵיי' },
        { en: 'week', he: 'שבוע', sound: 'וִויק' },
      ],
      sentences: [
        { en: 'I drink coffee every day', he: 'אני שותה קפה כל יום' },
        { en: 'I always eat breakfast', he: 'אני תמיד אוכל ארוחת בוקר', heAlt: ['אני תמיד אוכלת ארוחת בוקר'] },
        { en: 'I never drink milk', he: 'אני אף פעם לא שותה חלב', errors: ['E9'] },
        { en: 'See you next week', he: 'נתראה בשבוע הבא' },
      ],
    },
    {
      id: 'u5l4',
      title: 'סדר היום שלי',
      tip: 'שעה באה עם [[at]]: [[at seven]]. הביתה זה [[home]] בלי [[to]] ובלי [[the]]: [[I go home]].',
      words: [
        { en: 'get up', he: 'לקום', sound: 'גֶט אַפּ' },
        { en: 'shower', he: 'מקלחת', sound: 'שָאוּאֶר' },
        { en: 'home', he: 'הביתה', sound: 'הוֹם' },
        { en: 'TV', he: 'טלוויזיה', sound: 'טִי וִוי' },
        { en: 'watch', he: 'לצפות', sound: 'ווֹץ׳' },
      ],
      sentences: [
        { en: 'I get up at seven', he: 'אני קם בשבע', heAlt: ['אני קמה בשבע'], errors: ['E15'] },
        {
          en: 'I have breakfast at home',
          he: 'אני אוכל ארוחת בוקר בבית',
          alt: ['I eat breakfast at home'],
          heAlt: ['אני אוכלת ארוחת בוקר בבית'],
          errors: ['E15'],
        },
        { en: 'We watch TV at night', he: 'אנחנו רואים טלוויזיה בלילה', errors: ['E15'] },
        {
          en: 'I go home at five',
          he: 'אני הולך הביתה בחמש',
          heAlt: ['אני הולכת הביתה בחמש'],
          errors: ['E3', 'E15'],
        },
      ],
    },
    {
      id: 'u5l5',
      title: 'בדרך כלל',
      tip: '[[usually]], [[sometimes]] ו־[[often]] באים לפני הפועל: [[I usually walk]]. סוף השבוע: [[on the weekend]].',
      words: [
        { en: 'usually', he: 'בדרך כלל', sound: 'יוּז׳וּאָלִי' },
        { en: 'sometimes', he: 'לפעמים', sound: 'סָאמְטַיימְז' },
        { en: 'often', he: 'לעתים קרובות', sound: 'אוֹפֶן' },
        { en: 'weekend', he: 'סוף שבוע', sound: 'וִויקֶנְד' },
        { en: 'walk', he: 'ללכת ברגל', sound: 'ווֹק' },
      ],
      sentences: [
        {
          en: 'I usually walk to work',
          he: 'בדרך כלל אני הולך ברגל לעבודה',
          heAlt: ['בדרך כלל אני הולכת ברגל לעבודה'],
          errors: ['E3'],
        },
        { en: 'She sometimes drinks tea', he: 'לפעמים היא שותה תה', alt: ['Sometimes she drinks tea'], errors: ['E7'] },
        { en: 'We often eat pizza', he: 'אנחנו אוכלים פיצה לעתים קרובות', alt: ['We eat pizza often'] },
        {
          en: 'What do you do on the weekend?',
          he: 'מה אתה עושה בסוף השבוע?',
          alt: ['What do you do at the weekend', 'What do you do on weekends'],
          heAlt: ['מה את עושה בסוף השבוע?'],
          errors: ['E8', 'E14', 'E15'],
        },
      ],
    },
  ],
};
