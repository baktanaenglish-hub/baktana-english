import type { Unit } from '../../types';

/**
 * Unit 1. Owner: content-a (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit1: Unit = {
  id: 'u1',
  title: 'יחידה 1: צעדים ראשונים',
  description: 'ברכות, היכרות ונימוס',
  color: '#1f7cf2',
  level: 'Pre-A1',
  intro: {
    tip: "באנגלית לא מוותרים על [[am / is / are]]: אומרים [[I am good]] ולא [[I good]]. ו־[[you]] אחד משמש גם ל״אתה״, גם ל״את״ וגם ל״אתם״.",
    goals: ["לברך ולהיפרד", "להציג את עצמי ולשאול לשלום", "לבקש ולהתנצל בנימוס"],
  },
  lessons: [
    {
      id: 'u1l1',
      title: 'שלום!',
      words: [
        { en: 'hello', he: 'שלום', sound: 'הֶלוֹ' },
        { en: 'goodbye', he: 'להתראות', sound: 'גוּדבַּיי' },
        { en: 'yes', he: 'כן', sound: 'יֶס' },
        { en: 'no', he: 'לא', sound: 'נוֹ' },
        { en: 'thanks', he: 'תודה', sound: 'ת׳נקס' },
      ],
      sentences: [
        { en: 'Thanks, goodbye!', he: 'תודה, להתראות!', alt: ['Thanks goodbye', 'Thank you, goodbye'] },
        { en: 'Yes, thanks', he: 'כן, תודה', alt: ['Yes thank you'] },
        { en: 'No, thanks', he: 'לא, תודה', alt: ['No thank you'] },
      ],
    },
    {
      id: 'u1l2',
      title: 'אני ואתה',
      tip: 'באנגלית חייבים את [[am / is / are]]: [[I am]], [[you are]], [[she is]]. ו־[[good]] לא משתנה לפי מין: [[He is good]], [[She is good]].',
      words: [
        { en: 'I', he: 'אני', sound: 'אַיי' },
        { en: 'you', he: 'אתה/את', sound: 'יוּ' },
        { en: 'he', he: 'הוא', sound: 'הִי' },
        { en: 'she', he: 'היא', sound: 'שִׁי' },
        { en: 'good', he: 'טוב', sound: 'גוּד' },
      ],
      sentences: [
        { en: 'I am good', he: 'אני טוב', alt: ["I'm good"], heAlt: ['אני טובה'], errors: ['E1'] },
        { en: 'You are good', he: 'אתה טוב', alt: ["You're good"], heAlt: ['את טובה'], errors: ['E1', 'E13'] },
        { en: 'She is good', he: 'היא טובה', alt: ["She's good"], errors: ['E1', 'E13'] },
      ],
    },
    {
      id: 'u1l3',
      title: 'מה שלומך?',
      words: [
        { en: 'how', he: 'איך', sound: 'הָאוּ' },
        { en: 'fine', he: 'בסדר', sound: 'פַיין' },
        { en: 'name', he: 'שם', sound: 'נֵיים' },
        { en: 'my', he: 'שלי', sound: 'מַיי' },
        { en: 'what', he: 'מה', sound: 'ווֹט' },
      ],
      sentences: [
        { en: 'How are you?', he: 'מה שלומך?', errors: ['E1'] },
        { en: 'I am fine, thanks', he: 'אני בסדר, תודה', alt: ["I'm fine thanks", 'I am fine thank you'], errors: ['E1'] },
        { en: 'What is your name?', he: 'מה השם שלך?', alt: ["What's your name"], errors: ['E1', 'E12'] },
        { en: 'My name is Dana', he: 'השם שלי הוא דנה', alt: ["My name's Dana", "I'm Dana", 'I am Dana'], errors: ['E1'] },
      ],
    },
    {
      id: 'u1l4',
      title: 'מילות נימוס',
      tip: "אומרים [[I'm sorry]] כשמתנצלים, ו־[[Excuse me]] כשפונים למישהו. בעברית שתיהן יכולות להיות ״סליחה״.",
      words: [
        { en: 'please', he: 'בבקשה', sound: 'פְּלִיז' },
        { en: 'sorry', he: 'מצטער/ת', sound: 'סוֹרִי' },
        { en: 'excuse me', he: 'סליחה', sound: 'אֶקסְקְיוּז מִי' },
        { en: 'welcome', he: 'ברוכים הבאים', sound: 'וֶלְקַם' },
        { en: 'OK', he: 'אוקיי', sound: 'אוֹקֵיי' },
      ],
      sentences: [
        { en: 'Excuse me, what is your name?', he: 'סליחה, מה השם שלך?', alt: ["Excuse me, what's your name"], errors: ['E1'] },
        { en: "I'm sorry", he: 'אני מצטער', alt: ['I am sorry'], heAlt: ['אני מצטערת'], errors: ['E1'] },
        { en: 'Welcome to Israel!', he: 'ברוכים הבאים לישראל!' },
        { en: 'Yes, please', he: 'כן, בבקשה' },
      ],
    },
    {
      id: 'u1l5',
      title: 'נעים להכיר',
      tip: 'גם עם [[we]] ו־[[they]] צריך [[are]]: [[We are from Israel]]. בשאלה [[are]] בא לפני [[you]]: [[Where are you from?]]',
      words: [
        { en: 'we', he: 'אנחנו', sound: 'וִוי' },
        { en: 'they', he: 'הם', sound: 'דֵ׳יי' },
        { en: 'it', he: 'זה', sound: 'אִיט' },
        { en: 'nice', he: 'נחמד', sound: 'נַייס' },
        { en: 'from', he: 'מ־', sound: 'פְרוֹם' },
      ],
      sentences: [
        { en: 'Nice to meet you', he: 'נעים להכיר', alt: ['Nice to meet you too'] },
        { en: 'Where are you from?', he: 'מאיפה אתה?', heAlt: ['מאיפה את?'], errors: ['E1', 'E14'] },
        { en: 'We are from Israel', he: 'אנחנו מישראל', alt: ["We're from Israel"], errors: ['E1'] },
        { en: 'They are nice', he: 'הם נחמדים', alt: ["They're nice"], errors: ['E1'] },
      ],
    },
  ],
};
