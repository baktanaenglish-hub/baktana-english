import type { Unit } from '../../types';

/**
 * Unit 10 (new in v2). Owner: content-b (see docs/spec/v2.md §5 and §10).
 * Lessons u10l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit10: Unit = {
  id: 'u10',
  title: "יחידה 10: אתמול",
  description: "מספרים מה עשינו – עבר פשוט",
  color: '#d9480f',
  level: 'A2',
  intro: {
    tip: "בעבר רוב הפעלים מקבלים [[ed]]: [[worked]], [[played]]; חלק לא רגילים: [[went]], [[ate]], [[saw]]. בשאלה ובשלילה העבר עובר ל־[[did]] והפועל חוזר לבסיס: [[Did you go?]] – ולא [[Did you went?]]",
    goals: ["לספר איפה הייתי", "לספר מה עשיתי אתמול", "לשאול ולהגיד מה לא עשיתי"],
  },
  lessons: [
    {
      id: 'u10l1',
      title: 'איפה היית?',
      tip: 'הייתי = [[I was]], היינו = [[we were]]. עם [[you]] תמיד [[were]]: [[Where were you?]] גם כשמדברים לאדם אחד.',
      words: [
        { en: 'yesterday', he: 'אתמול', sound: 'יֶסְטֶרְדֵיי' },
        { en: 'was', he: 'היה', sound: 'ווֹז' },
        { en: 'were', he: 'היו', sound: 'וֶור' },
        { en: 'last', he: 'שעבר', sound: 'לָאסְט' },
        { en: 'ago', he: 'לפני (זמן)', sound: 'אֲגוֹ' },
      ],
      sentences: [
        { en: 'I was at home yesterday', he: 'הייתי בבית אתמול', alt: ['Yesterday I was at home'], errors: ['E15'] },
        { en: 'Where were you?', he: 'איפה היית?', errors: ['E14'] },
        { en: 'It was cold last night', he: 'היה קר אתמול בלילה', errors: ['E1'] },
        { en: 'We were in Eilat last week', he: 'היינו באילת בשבוע שעבר', alt: ['Last week we were in Eilat'] },
      ],
    },
    {
      id: 'u10l2',
      title: 'מה עשיתי אתמול',
      tip: 'רוב הפעלים מקבלים [[ed]] בעבר. אומרים [[worked]] ב־"ט" בסוף, [[stayed]] ב־"ד", ורק אחרי [[t]] או [[d]] מוסיפים הברה: [[vi-si-ted]].',
      words: [
        { en: 'visit', he: 'לבקר', sound: 'וִיזִיט' },
        { en: 'stay', he: 'להישאר', sound: 'סְטֵיי' },
        { en: 'finish', he: 'לסיים', sound: 'פִינִיש' },
        { en: 'start', he: 'להתחיל', sound: 'סְטָארְט' },
        { en: 'open', he: 'לפתוח', sound: 'אוֹפֶּן' },
      ],
      sentences: [
        { en: 'I worked yesterday', he: 'עבדתי אתמול', alt: ['Yesterday I worked'], errors: ['E20'] },
        { en: 'We visited our family', he: 'ביקרנו את המשפחה שלנו', errors: ['E20'] },
        { en: 'I finished my homework', he: 'סיימתי את שיעורי הבית', errors: ['E20'] },
        { en: 'They stayed at home', he: 'הם נשארו בבית', alt: ['They stayed home'], errors: ['E15', 'E20'] },
      ],
    },
    {
      id: 'u10l3',
      title: 'הלכתי, אכלתי, ראיתי',
      tip: 'לפעלים הכי שכיחים יש צורת עבר משלהם, בלי [[ed]]: [[go → went]], [[eat → ate]], [[see → saw]], [[have → had]], [[take → took]].',
      words: [
        { en: 'went', he: 'הלך', sound: 'וֶנְט' },
        { en: 'ate', he: 'אכל', sound: 'אֵייט' },
        { en: 'saw', he: 'ראה', sound: 'סוֹ' },
        { en: 'had', he: 'היה ל־', sound: 'הֶד' },
        { en: 'took', he: 'לקח', sound: 'טוּק' },
      ],
      sentences: [
        { en: 'I went to the beach', he: 'הלכתי לים', errors: ['E3'] },
        { en: 'We ate falafel', he: 'אכלנו פלאפל' },
        {
          en: 'I saw my friend yesterday',
          he: 'ראיתי את החבר שלי אתמול',
          alt: ['Yesterday I saw my friend'],
          heAlt: ['ראיתי את החברה שלי אתמול'],
        },
        { en: 'She had a headache', he: 'היה לה כאב ראש', errors: ['E2', 'E6'] },
      ],
    },
    {
      id: 'u10l4',
      title: 'עשית את זה?',
      tip: 'בשאלה על העבר [[did]] כבר אומר "עבר", אז הפועל חוזר לבסיס: [[Did you see…?]] – ולא [[Did you saw…?]] תשובה קצרה: [[Yes, I did]].',
      words: [
        { en: 'see', he: 'לראות', sound: 'סִי' },
        { en: 'movie', he: 'סרט', sound: 'מוּבִי' },
        { en: 'party', he: 'מסיבה', sound: 'פָּארְטִי' },
        { en: 'enjoy', he: 'ליהנות', sound: 'אֶנְג׳וֹי' },
        { en: 'fun', he: 'כיף', sound: 'פָאן' },
      ],
      sentences: [
        { en: 'Did you see the movie?', he: 'ראית את הסרט?', alt: ['Did you see the film'], errors: ['E16'] },
        { en: 'Did she like the party?', he: 'היא אהבה את המסיבה?', errors: ['E16'] },
        { en: 'Did you enjoy the weekend?', he: 'נהנית בסוף השבוע?', errors: ['E16'] },
        { en: 'Did they call you? Yes, they did', he: 'הם התקשרו אליך? כן', errors: ['E16'] },
      ],
    },
    {
      id: 'u10l5',
      title: 'לא עשיתי',
      tip: "בשלילה בעבר אומרים [[didn't]] + פועל בסיס: [[I didn't sleep]] – ולא [[I didn't slept]].",
      words: [
        { en: 'forget', he: 'לשכוח', sound: 'פוֹרְגֶט' },
        { en: 'remember', he: 'לזכור', sound: 'רִימֶמְבֶּר' },
        { en: 'arrive', he: 'להגיע', sound: 'אֲרַייב' },
        { en: 'miss', he: 'לפספס', sound: 'מִיס' },
        { en: 'lesson', he: 'שיעור', sound: 'לֶסֶן' },
      ],
      sentences: [
        {
          en: "I didn't sleep last night",
          he: 'לא ישנתי אתמול בלילה',
          alt: ['I did not sleep last night'],
          errors: ['E16'],
        },
        {
          en: "She didn't remember my name",
          he: 'היא לא זכרה את השם שלי',
          alt: ['She did not remember my name'],
          errors: ['E16'],
        },
        { en: 'We missed the bus', he: 'פספסנו את האוטובוס', errors: ['E20'] },
        { en: "The bus didn't arrive", he: 'האוטובוס לא הגיע', alt: ['The bus did not arrive'], errors: ['E16'] },
      ],
    },
  ],
};
