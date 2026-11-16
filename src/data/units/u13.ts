import type { Unit } from '../../types';

/** Unit 13 (added after v2): at work. Same rules as the other units (see README.md). */
export const unit13: Unit = {
  id: 'u13',
  title: 'יחידה 13: בעבודה',
  description: 'פגישות, כסף, ראיון עבודה ואימייל',
  color: '#0b7285',
  level: 'A2',
  intro: {
    tip: 'בעבודה משתמשים בנימוס: [[Can you…?]] לבקשה, [[I have a meeting]] להסביר שאתם עסוקים, ו־[[I will send you an email]] להבטיח. שימו לב: [[I have a meeting]] – עם [[a]], ובלי [[to]] אחרי [[will]].',
    goals: ['לדבר על העבודה והפגישות', 'לדבר על כסף ועל משכורת', 'להתכונן לראיון ולכתוב אימייל קצר'],
  },
  lessons: [
    {
      id: 'u13l1',
      title: 'במשרד',
      tip: 'פגישה היא [[a meeting]] – תמיד עם [[a]]: [[I have a meeting]]. מקום עבודה: [[at my desk]].',
      words: [
        { en: 'meeting', he: 'פגישה', sound: 'מִיטִינְג' },
        { en: 'boss', he: 'הבוס', sound: 'בּוֹס' },
        { en: 'colleague', he: 'עמית לעבודה', sound: 'קוֹלִיג' },
        { en: 'desk', he: 'שולחן כתיבה', sound: 'דֶסְק' },
        { en: 'computer', he: 'מחשב', sound: 'קוֹמְפְּיוּטֶר' },
      ],
      sentences: [
        { en: 'I have a meeting at ten', he: 'יש לי פגישה בעשר', errors: ['E2', 'E6', 'E15'] },
        { en: 'My boss is in a meeting', he: 'הבוס שלי בפגישה', errors: ['E1', 'E2'] },
        { en: 'My colleague is at his desk', he: 'העמית שלי לעבודה ליד שולחן הכתיבה שלו', errors: ['E1', 'E15'] },
        { en: 'This computer is slow', he: 'המחשב הזה איטי', errors: ['E1'] },
      ],
    },
    {
      id: 'u13l2',
      title: 'משכורת וכסף',
      tip: 'כסף הוא [[money]] – אין לו רבים ואין [[a]]: [[I have money]]. [[much]] הולכת עם שם עצם שאי אפשר לספור: [[too much money]], [[How much money do you have?]]. שימו לב: [[too]] כאן פירושו "יותר מדי", לא "גם".',
      words: [
        { en: 'salary', he: 'משכורת', sound: 'סָלֶרִי' },
        { en: 'money', he: 'כסף', sound: 'מָאנִי' },
        { en: 'pay', he: 'לשלם', sound: 'פֵּיי' },
        { en: 'save', he: 'לחסוך', sound: 'סֵייב' },
        { en: 'spend', he: 'להוציא כסף', sound: 'סְפֶּנְד' },
      ],
      sentences: [
        { en: 'My salary is good', he: 'המשכורת שלי טובה', errors: ['E1'] },
        {
          en: 'I save money every month',
          he: 'אני חוסך כסף כל חודש',
          heAlt: ['אני חוסכת כסף כל חודש'],
        },
        {
          en: 'I spend too much money',
          he: 'אני מוציא יותר מדי כסף',
          heAlt: ['אני מוציאה יותר מדי כסף'],
          errors: ['E23'],
        },
        { en: 'They pay me on Friday', he: 'משלמים לי ביום שישי', errors: ['E15'] },
      ],
    },
    {
      id: 'u13l3',
      title: 'ראיון עבודה',
      tip: 'לפני מילה שמתחילה בצליל של תנועה אומרים [[an]]: [[an interview]], [[an email]]. ניסיון הוא [[experience]] – בלי [[a]] ובלי רבים.',
      words: [
        { en: 'interview', he: 'ראיון', sound: 'אִינְטֶרְוְיוּ' },
        { en: 'experience', he: 'ניסיון', sound: 'אִיקְסְפִּירִיאֶנְס' },
        { en: 'skill', he: 'כישור', sound: 'סְקִיל' },
        { en: 'apply', he: 'להגיש מועמדות', sound: 'אַפְּלַיי' },
        { en: 'CV', he: 'קורות חיים', sound: 'סִי־וִי' },
      ],
      sentences: [
        { en: 'I have an interview tomorrow', he: 'יש לי ראיון מחר', errors: ['E2', 'E6'] },
        { en: 'I have experience', he: 'יש לי ניסיון', errors: ['E6'] },
        { en: 'I want to apply for this job', he: 'אני רוצה להגיש מועמדות למשרה הזאת' },
        {
          en: 'Send me your CV, please',
          he: 'שלח לי את קורות החיים שלך, בבקשה',
          heAlt: ['שלחי לי את קורות החיים שלך, בבקשה'],
          alt: ['Please send me your CV'],
        },
      ],
    },
    {
      id: 'u13l4',
      title: 'אימייל',
      tip: 'מבטיחים עם [[will]]: [[I will send you an email]]. בדרך כלל מקצרים: [[I\'ll send it today]]. אחרי [[will]] פועל בסיס, בלי [[to]].',
      words: [
        { en: 'email', he: 'אימייל', sound: 'אִימֵייל' },
        { en: 'reply', he: 'להשיב', sound: 'רִיפְּלַיי' },
        { en: 'subject', he: 'נושא', sound: 'סָאבְּג׳קְט' },
        { en: 'attach', he: 'לצרף', sound: 'אַטַץ׳' },
        { en: 'deadline', he: 'מועד אחרון', sound: 'דֶדְלַיין' },
      ],
      sentences: [
        {
          en: 'I will send you an email',
          he: 'אשלח לך אימייל',
          alt: ["I'll send you an email"],
          errors: ['E2', 'E27'],
        },
        { en: 'Please reply today', he: 'בבקשה תשיב היום', heAlt: ['בבקשה תשיבי היום'], alt: ['Reply today, please'] },
        { en: 'The subject is the meeting', he: 'הנושא הוא הפגישה', alt: ["The subject's the meeting"], errors: ['E1', 'E3'] },
        { en: 'The deadline is Friday', he: 'המועד האחרון הוא יום שישי', alt: ["The deadline's Friday", 'The deadline is on Friday'], errors: ['E1'] },
      ],
    },
    {
      id: 'u13l5',
      title: 'עבודת צוות',
      tip: 'צוות הוא [[a team]]. אומרים [[in a team]] ו־[[on a project]]: [[I work on a project]]. הפסקה: [[take a break]].',
      words: [
        { en: 'team', he: 'צוות', sound: 'טִים' },
        { en: 'project', he: 'פרויקט', sound: 'פְּרוֹג׳קְט' },
        { en: 'manager', he: 'מנהל', sound: 'מָנֶגֶ׳ר' },
        { en: 'break', he: 'הפסקה', sound: 'בְּרֵייק' },
        { en: 'schedule', he: 'לוח זמנים', sound: 'סְקֶג׳וּל' },
      ],
      sentences: [
        { en: 'I work in a team', he: 'אני עובד בצוות', heAlt: ['אני עובדת בצוות'], errors: ['E2', 'E15'] },
        { en: 'We have a new project', he: 'יש לנו פרויקט חדש', errors: ['E4', 'E6'] },
        { en: 'The manager is busy', he: 'המנהל עסוק', errors: ['E1'] },
        { en: "Let's take a break", he: 'בואו ניקח הפסקה', alt: ['Let us take a break'], errors: ['E2'] },
      ],
    },
  ],
};
