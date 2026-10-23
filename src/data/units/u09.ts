import type { Unit } from '../../types';

/**
 * Unit 9 (new in v2). Owner: content-a (see docs/spec/v2.md §5 and §10).
 * Lessons u9l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit9: Unit = {
  id: 'u9',
  title: "יחידה 9: גוף, בריאות ורגשות",
  description: "אצל הרופא, חובות, רגשות ותחביבים",
  color: '#7c5cff',
  level: 'A1+',
  intro: {
    tip: "כאב אומרים עם [[I have]]: [[I have a headache]] (כואב לי הראש). עצה: [[You should rest]]. חובה: [[I have to work]]. אחרי [[should]] ו־[[have to]] בא הפועל בצורה הבסיסית.",
    goals: ["להסביר לרופא מה כואב", "להגיד מה אני חייב לעשות", "לדבר על רגשות ותחביבים"],
  },
  lessons: [
    {
      id: 'u9l1',
      title: 'הגוף',
      tip: '״כואב לי הראש״ = [[I have a headache]] או [[My head hurts]]. איבר אחד הוא כמו [[it]], ולכן הפועל מקבל [[s]]: [[My leg hurts]]. ועם [[he / she]] אומרים [[has]]: [[She has a headache]].',
      words: [
        { en: 'head', he: 'ראש', sound: 'הֶד' },
        { en: 'hand', he: 'יד', sound: 'הֶנְד' },
        { en: 'eye', he: 'עין', sound: 'אַיי' },
        { en: 'leg', he: 'רגל', sound: 'לֶג' },
        { en: 'stomach', he: 'בטן', sound: 'סְטָאמֶק' },
      ],
      sentences: [
        { en: 'I have a headache', he: 'כואב לי הראש', errors: ['E2', 'E6'] },
        { en: 'My leg hurts', he: 'כואבת לי הרגל', errors: ['E7'] },
        { en: 'She has blue eyes', he: 'יש לה עיניים כחולות', errors: ['E4', 'E6'] },
        { en: 'I have a stomachache', he: 'כואבת לי הבטן', alt: ['I have a stomach ache'], errors: ['E2', 'E6'] },
      ],
    },
    {
      id: 'u9l2',
      title: 'אצל הרופא',
      tip: 'עצה נותנים עם [[should]] + פועל בלי [[to]]: [[You should rest]].',
      words: [
        { en: 'sick', he: 'חולה', sound: 'סִיק' },
        { en: 'medicine', he: 'תרופה', sound: 'מֶדִיסִין' },
        { en: 'rest', he: 'לנוח', sound: 'רֶסְט' },
        { en: 'should', he: 'כדאי', sound: 'שוּד' },
        { en: 'feel', he: 'להרגיש', sound: 'פִיל' },
      ],
      sentences: [
        { en: 'What is the matter?', he: 'מה קרה?', alt: ["What's the matter"], errors: ['E1'] },
        { en: 'I feel sick', he: 'אני מרגיש חולה', alt: ['I feel ill'], heAlt: ['אני מרגישה חולה'] },
        { en: 'You should rest', he: 'כדאי לך לנוח', errors: ['E27'] },
        { en: 'Take this medicine', he: 'קח את התרופה הזאת', heAlt: ['קחי את התרופה הזאת'], errors: ['E3'] },
      ],
    },
    {
      id: 'u9l3',
      title: 'אני חייב',
      tip: "חובה: [[I have to]], ועם [[he / she]]: [[has to]]. [[You don't have to]] = אתה לא חייב (אבל מותר).",
      words: [
        { en: 'homework', he: 'שיעורי בית', sound: 'הוֹמְוֶורְק' },
        { en: 'exam', he: 'מבחן', sound: 'אִיגְזֶם' },
        { en: 'army', he: 'צבא', sound: 'אָרְמִי' },
        { en: 'clean', he: 'לנקות', sound: 'קְלִין' },
        { en: 'tomorrow', he: 'מחר', sound: 'טוּמוֹרוֹ' },
      ],
      sentences: [
        { en: 'I have to work today', he: 'אני צריך לעבוד היום', heAlt: ['אני צריכה לעבוד היום'] },
        { en: 'She has to study for the exam', he: 'היא צריכה ללמוד למבחן', errors: ['E7'] },
        {
          en: "You don't have to clean",
          he: 'אתה לא חייב לנקות',
          alt: ['You do not have to clean'],
          heAlt: ['את לא חייבת לנקות'],
          errors: ['E8'],
        },
        { en: 'I have an exam tomorrow', he: 'יש לי מבחן מחר', errors: ['E2', 'E6'] },
      ],
    },
    {
      id: 'u9l4',
      title: 'רגשות',
      tip: '[[bored]] = משועמם (מה שאני מרגיש). [[boring]] = משעמם (הדבר עצמו). [[I am boring]] אומר ״אני אדם משעמם״!',
      words: [
        { en: 'bored', he: 'משועמם', sound: 'בּוֹרְד' },
        { en: 'angry', he: 'כועס', sound: 'אֶנְגְרִי' },
        { en: 'worried', he: 'מודאג', sound: 'וָורִיד' },
        { en: 'excited', he: 'נרגש', sound: 'אִיקְסַייטִיד' },
        { en: 'because', he: 'כי', sound: 'בִּיקוֹז' },
      ],
      sentences: [
        { en: 'I am bored', he: 'משעמם לי', alt: ["I'm bored"], errors: ['E1', 'E25'] },
        { en: 'Why are you angry?', he: 'למה אתה כועס?', heAlt: ['למה את כועסת?'], errors: ['E1', 'E14'] },
        {
          en: 'I am happy because it is Friday',
          he: 'אני שמח כי היום יום שישי',
          alt: ["I'm happy because it's Friday", "I'm happy because it is Friday", "I am happy because it's Friday"],
          heAlt: ['אני שמחה כי היום יום שישי'],
          errors: ['E1'],
        },
        { en: 'We are excited', he: 'אנחנו נרגשים', alt: ["We're excited"], errors: ['E1', 'E25'] },
      ],
    },
    {
      id: 'u9l5',
      title: 'תחביבים',
      tip: 'משחקים ספורט בלי [[the]]: [[play football]]. מנגנים בכלי עם [[the]]: [[play the guitar]].',
      words: [
        { en: 'football', he: 'כדורגל', sound: 'פוּטְבּוֹל' },
        { en: 'music', he: 'מוזיקה', sound: 'מְיוּזִיק' },
        { en: 'guitar', he: 'גיטרה', sound: 'גִיטָאר' },
        { en: 'free', he: 'פנוי', sound: 'פְרִי' },
        { en: 'hobby', he: 'תחביב', sound: 'הוֹבִּי' },
      ],
      sentences: [
        {
          en: 'What do you do in your free time?',
          he: 'מה אתה עושה בזמן הפנוי?',
          heAlt: ['מה את עושה בזמן הפנוי?'],
          errors: ['E8', 'E14'],
        },
        { en: 'I like playing football', he: 'אני אוהב לשחק כדורגל', alt: ['I like to play football'], heAlt: ['אני אוהבת לשחק כדורגל'] },
        { en: 'He plays the guitar', he: 'הוא מנגן בגיטרה', alt: ['He plays guitar'], errors: ['E7'] },
        { en: 'I love music', he: 'אני ממש אוהב מוזיקה', heAlt: ['אני ממש אוהבת מוזיקה'] },
      ],
    },
  ],
};
