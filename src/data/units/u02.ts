import type { Unit } from '../../types';

/**
 * Unit 2. Owner: content-a (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit2: Unit = {
  id: 'u2',
  title: 'יחידה 2: משפחה וחברים',
  description: 'אנשים סביבנו – תיאור, שייכות ושלילה',
  color: '#00a99d',
  level: 'Pre-A1',
  intro: {
    tip: "לפני שם עצם ביחיד שמים [[a]]: [[I am a boy]]. [[his]] ו־[[her]] תלויים במי שהדבר שייך לו: [[his mother]] = אמא שלו. בשלילה מוסיפים [[not]]: [[I am not tired]].",
    goals: ["לתאר אנשים ובני משפחה", "להגיד של מי משהו", "לענות בקצרה: [[Yes, I am]] / [[No, he isn't]]"],
  },
  lessons: [
    {
      id: 'u2l1',
      title: 'אנשים',
      words: [
        { en: 'man', he: 'גבר', sound: 'מֶן' },
        { en: 'woman', he: 'אישה', sound: 'ווּמַן' },
        { en: 'boy', he: 'ילד', sound: 'בּוֹי' },
        { en: 'girl', he: 'ילדה', sound: 'גֶרל' },
        { en: 'friend', he: 'חבר', sound: 'פרֶנד' },
      ],
      sentences: [
        { en: 'I am a boy', he: 'אני ילד', alt: ["I'm a boy"], errors: ['E1', 'E2'] },
        { en: 'She is a girl', he: 'היא ילדה', alt: ["She's a girl"], errors: ['E1', 'E2'] },
        { en: 'He is my friend', he: 'הוא החבר שלי', alt: ["He's my friend"], errors: ['E1'] },
      ],
    },
    {
      id: 'u2l2',
      title: 'המשפחה שלי',
      words: [
        { en: 'mother', he: 'אמא', sound: 'מָאדֶ׳ר' },
        { en: 'father', he: 'אבא', sound: 'פָאדֶ׳ר' },
        { en: 'brother', he: 'אח', sound: 'בּרָאדֶ׳ר' },
        { en: 'sister', he: 'אחות', sound: 'סִיסטֶר' },
        { en: 'family', he: 'משפחה', sound: 'פֶמִילִי' },
      ],
      sentences: [
        { en: 'This is my mother', he: 'זאת אמא שלי', alt: ["This is my mom"], errors: ['E1', 'E11'] },
        { en: 'I have a sister', he: 'יש לי אחות', errors: ['E2', 'E6'] },
        { en: 'This is my father', he: 'זה אבא שלי', alt: ['This is my dad'], errors: ['E1', 'E11'] },
      ],
    },
    {
      id: 'u2l3',
      title: 'של מי זה?',
      tip: '[[his]] או [[her]] נקבע לפי מי שהדבר שייך לו, לא לפי הדבר עצמו: [[her brother]] = האח שלה.',
      words: [
        { en: 'his', he: 'שלו', sound: 'הִיז' },
        { en: 'her', he: 'שלה', sound: 'הֶר' },
        { en: 'your', he: 'שלך', sound: 'יוֹר' },
        { en: 'our', he: 'שלנו', sound: 'אָאוּר' },
        { en: 'bag', he: 'תיק', sound: 'בֶּג' },
      ],
      sentences: [
        { en: 'Her name is Noa', he: 'השם שלה הוא נועה', alt: ["Her name's Noa"], errors: ['E1', 'E13'] },
        { en: 'His sister is my friend', he: 'האחות שלו היא החברה שלי', errors: ['E13'] },
        { en: 'Is this your bag?', he: 'זה התיק שלך?', errors: ['E1', 'E8'] },
        { en: 'This is our family', he: 'זאת המשפחה שלנו' },
      ],
    },
    {
      id: 'u2l4',
      title: 'איך הוא נראה?',
      tip: 'בשאלה עם [[is / are]] מחליפים את הסדר: [[He is tall]] ← [[Is he tall?]]. תשובה קצרה: [[Yes, he is]].',
      words: [
        { en: 'big', he: 'גדול', sound: 'בִּיג' },
        { en: 'small', he: 'קטן', sound: 'סְמוֹל' },
        { en: 'tall', he: 'גבוה', sound: 'טוֹל' },
        { en: 'happy', he: 'שמח', sound: 'הֶפִּי' },
        { en: 'tired', he: 'עייף', sound: 'טַייאֶרְד' },
      ],
      sentences: [
        { en: 'Is he tall? Yes, he is', he: 'הוא גבוה? כן', errors: ['E1', 'E8'] },
        { en: 'I am happy', he: 'אני שמח', alt: ["I'm happy"], heAlt: ['אני שמחה'], errors: ['E1', 'E13'] },
        { en: 'My brother is small', he: 'אחי קטן', alt: ["My brother's small"], errors: ['E1'] },
        { en: 'Are you tired?', he: 'אתה עייף?', heAlt: ['את עייפה?'], errors: ['E1', 'E8'] },
      ],
    },
    {
      id: 'u2l5',
      title: 'לא, אני לא',
      tip: "שלילה: מוסיפים [[not]] אחרי [[am / is / are]]. בדיבור מקצרים: [[isn't]], [[aren't]], [[I'm not]].",
      words: [
        { en: 'here', he: 'כאן', sound: 'הִיר' },
        { en: 'late', he: 'מאחר', sound: 'לֵייט' },
        { en: 'busy', he: 'עסוק', sound: 'בִּיזִי' },
        { en: 'sad', he: 'עצוב', sound: 'סֶד' },
        { en: 'ready', he: 'מוכן', sound: 'רֶדִי' },
      ],
      sentences: [
        { en: 'I am not tired', he: 'אני לא עייף', alt: ["I'm not tired"], heAlt: ['אני לא עייפה'], errors: ['E1'] },
        { en: 'He is not here', he: 'הוא לא כאן', alt: ["He isn't here", "He's not here"], errors: ['E1'] },
        { en: 'We are not late', he: 'אנחנו לא מאחרים', alt: ["We aren't late", "We're not late"], errors: ['E1'] },
        {
          en: 'Are you ready? No, I am not',
          he: 'אתה מוכן? לא',
          alt: ["Are you ready? No, I'm not"],
          heAlt: ['את מוכנה? לא'],
          errors: ['E1', 'E8'],
        },
      ],
    },
  ],
};
