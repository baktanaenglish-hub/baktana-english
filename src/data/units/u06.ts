import type { Unit } from '../../types';

/**
 * Unit 6. Owner: content-b (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit6: Unit = {
  id: 'u6',
  title: 'יחידה 6: שאלות והווה פשוט',
  description: 'מספרים על אחרים, שואלים שאלות, מקצועות',
  color: '#4f46e5',
  level: 'A1',
  intro: {
    tip: "עם [[he]], [[she]], [[it]] מוסיפים לפועל [[s]]: [[He likes coffee]]. בשאלה ובשלילה ה־[[s]] עובר ל־[[does]] והפועל חוזר לבסיס: [[Does he like…?]], [[He doesn't like…]].",
    goals: ["לספר מה אחרים עושים", "לשאול שאלות כן/לא ושאלות [[wh-]]", "לדבר על מקצועות"],
  },
  lessons: [
    {
      id: 'u6l1',
      title: 'הוא אוהב, היא אוהבת',
      words: [
        { en: 'like', he: 'לאהוב', sound: 'לַייק' },
        { en: 'play', he: 'לשחק', sound: 'פּלֵיי' },
        { en: 'read', he: 'לקרוא', sound: 'רִיד' },
        { en: 'speak', he: 'לדבר', sound: 'ספִּיק' },
        { en: 'English', he: 'אנגלית', sound: 'אִינגלִיש' },
      ],
      sentences: [
        { en: 'He likes coffee', he: 'הוא אוהב קפה', errors: ['E7'] },
        { en: 'He speaks English', he: 'הוא מדבר אנגלית', errors: ['E7'] },
        {
          en: 'My mother reads every day',
          he: 'אמא שלי קוראת כל יום',
          alt: ['My mom reads every day'],
          errors: ['E7', 'E13'],
        },
        { en: 'She plays with her friend', he: 'היא משחקת עם החברה שלה', errors: ['E7', 'E13'] },
      ],
    },
    {
      id: 'u6l2',
      title: 'אתה מבין?',
      words: [
        { en: 'question', he: 'שאלה', sound: 'קְוֶוסְצ׳ֶן' },
        { en: 'answer', he: 'תשובה', sound: 'אַנסֶר' },
        { en: 'Hebrew', he: 'עברית', sound: 'הִיבּרוּ' },
        { en: 'understand', he: 'להבין', sound: 'אַנדֶרסטֶנד' },
        { en: 'know', he: 'לדעת', sound: 'נוֹאוּ' },
      ],
      sentences: [
        { en: 'Do you speak Hebrew?', he: 'אתה מדבר עברית?', heAlt: ['את מדברת עברית?'], errors: ['E8'] },
        { en: 'Do you understand?', he: 'אתה מבין?', heAlt: ['את מבינה?'], errors: ['E8'] },
        { en: 'Does she like tea?', he: 'היא אוהבת תה?', errors: ['E7', 'E8'] },
        { en: "I don't know", he: 'אני לא יודע', alt: ['I do not know'], heAlt: ['אני לא יודעת'] },
      ],
    },
    {
      id: 'u6l3',
      title: 'איפה? מתי? למה?',
      words: [
        { en: 'where', he: 'איפה', sound: 'וֶור' },
        { en: 'who', he: 'מי', sound: 'הוּ' },
        { en: 'when', he: 'מתי', sound: 'וֶן' },
        { en: 'why', he: 'למה', sound: 'וַואי' },
        { en: 'live', he: 'לגור', sound: 'לִיב' },
      ],
      sentences: [
        { en: 'Where do you live?', he: 'איפה אתה גר?', heAlt: ['איפה את גרה?'], errors: ['E8', 'E14'] },
        { en: 'I live in Tel Aviv', he: 'אני גר בתל אביב', heAlt: ['אני גרה בתל אביב'], errors: ['E15'] },
        { en: 'Who is she?', he: 'מי היא?', alt: ["Who's she"], errors: ['E1', 'E14'] },
        { en: 'When do you work?', he: 'מתי אתה עובד?', heAlt: ['מתי את עובדת?'], errors: ['E8', 'E14'] },
      ],
    },
    {
      id: 'u6l4',
      title: 'הוא לא אוכל בשר',
      tip: "אחרי [[doesn't]] ו־[[does]] הפועל חוזר לבסיס, בלי [[s]]: [[He doesn't eat]], [[Does she cook?]] – ולא [[He doesn't eats]].",
      words: [
        { en: 'meat', he: 'בשר', sound: 'מִיט' },
        { en: 'cook', he: 'לבשל', sound: 'קוּק' },
        { en: 'eat', he: 'לאכול', sound: 'אִיט' },
        { en: 'drive', he: 'לנהוג', sound: 'דְרַייב' },
        { en: 'car', he: 'מכונית', sound: 'קָאר' },
      ],
      sentences: [
        { en: "He doesn't eat meat", he: 'הוא לא אוכל בשר', alt: ['He does not eat meat'], errors: ['E7', 'E8'] },
        { en: 'Does she cook?', he: 'היא מבשלת?', errors: ['E8'] },
        {
          en: "My mother doesn't drive",
          he: 'אמא שלי לא נוהגת',
          alt: ["My mom doesn't drive", 'My mother does not drive'],
          errors: ['E7', 'E8'],
        },
        { en: 'Does he have a car?', he: 'יש לו מכונית?', errors: ['E6', 'E8'] },
      ],
    },
    {
      id: 'u6l5',
      title: 'במה אתה עובד?',
      tip: 'לפני מקצוע שמים [[a]] או [[an]]: [[I am a teacher]], [[She is a doctor]]. במה אתה עובד? = [[What do you do?]]',
      words: [
        { en: 'job', he: 'מקצוע', sound: 'ג׳וֹבּ' },
        { en: 'doctor', he: 'רופא', sound: 'דוֹקְטוֹר' },
        { en: 'teacher', he: 'מורה', sound: 'טִיצ׳ֶר' },
        { en: 'soldier', he: 'חייל', sound: 'סוֹלְג׳ֶר' },
        { en: 'student', he: 'תלמיד', sound: 'סְטוּדֶנְט' },
      ],
      sentences: [
        { en: 'What do you do?', he: 'במה אתה עובד?', heAlt: ['במה את עובדת?'], errors: ['E8', 'E14'] },
        { en: 'I am a teacher', he: 'אני מורה', alt: ["I'm a teacher"], errors: ['E1', 'E2'] },
        { en: 'My brother is a soldier', he: 'אחי חייל', alt: ["My brother's a soldier"], errors: ['E2'] },
        { en: 'Is she a doctor? Yes, she is', he: 'היא רופאה? כן', errors: ['E2', 'E8'] },
      ],
    },
  ],
};
