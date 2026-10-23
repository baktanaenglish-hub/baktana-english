import type { Unit } from '../../types';

/**
 * Unit 7 (new in v2). Owner: content-a (see docs/spec/v2.md §5 and §10).
 * Lessons u7l1 … are written from the spec; a unit without lessons is hidden by course.ts.
 */
export const unit7: Unit = {
  id: 'u7',
  title: "יחידה 7: בעיר",
  description: "מקומות, הוראות הגעה, תחבורה וקניות",
  color: '#f59f00',
  level: 'A1+',
  intro: {
    tip: "[[Is there a … near here?]] = יש … קרוב לכאן? בהוראות הגעה משתמשים בציווי בלי [[you]]: [[Turn left]]. ואחרי [[can]] לא בא [[to]]: [[I can swim]].",
    goals: ["לשאול איפה נמצא מקום", "להבין הוראות הגעה", "לנסוע בתחבורה ציבורית ולקנות"],
  },
  lessons: [
    {
      id: 'u7l1',
      title: 'מקומות בעיר',
      tip: "״יש״ של מקום הוא [[There is]], ו״אין״ הוא [[There isn't]]. בשאלה: [[Is there a bank near here?]]",
      words: [
        { en: 'shop', he: 'חנות', sound: 'שוֹפּ' },
        { en: 'bank', he: 'בנק', sound: 'בֶּנְק' },
        { en: 'park', he: 'פארק', sound: 'פָּארְק' },
        { en: 'station', he: 'תחנה', sound: 'סְטֵיישֶן' },
        { en: 'near', he: 'קרוב', sound: 'נִיר' },
      ],
      sentences: [
        { en: 'Is there a bank near here?', he: 'יש בנק קרוב לכאן?', errors: ['E2', 'E6'] },
        { en: 'There is a park near my house', he: 'יש פארק ליד הבית שלי', alt: ["There's a park near my house"], errors: ['E6'] },
        {
          en: "There isn't a shop here",
          he: 'אין פה חנות',
          alt: ['There is not a shop here', "There's no shop here", 'There is no shop here'],
          errors: ['E6'],
        },
        { en: 'Where is the station?', he: 'איפה התחנה?', alt: ["Where's the station"], errors: ['E1', 'E3'] },
      ],
    },
    {
      id: 'u7l2',
      title: 'איך מגיעים?',
      tip: 'בהוראות הגעה מתחילים ישר בפועל, בלי [[you]]: [[Turn left]], [[Go straight]].',
      words: [
        { en: 'left', he: 'שמאלה', sound: 'לֶפְט' },
        { en: 'right', he: 'ימינה', sound: 'רַייט' },
        { en: 'straight', he: 'ישר', sound: 'סְטְרֵייט' },
        { en: 'turn', he: 'לפנות', sound: 'טֶרְן' },
        { en: 'street', he: 'רחוב', sound: 'סְטְרִיט' },
      ],
      sentences: [
        { en: 'Turn right at the bank', he: 'פנה ימינה ליד הבנק', heAlt: ['פני ימינה ליד הבנק'], errors: ['E15'] },
        { en: 'Go straight', he: 'סע ישר', alt: ['Go straight on', 'Go straight ahead'], heAlt: ['סעי ישר'] },
        { en: 'The shop is next to the bank', he: 'החנות ליד הבנק', alt: ["The shop's next to the bank"], errors: ['E1', 'E3'] },
        {
          en: 'Excuse me, where is Allenby Street?',
          he: 'סליחה, איפה רחוב אלנבי?',
          alt: ["Excuse me, where's Allenby Street"],
          errors: ['E1'],
        },
      ],
    },
    {
      id: 'u7l3',
      title: 'בתחבורה ציבורית',
      tip: 'נוסעים [[by bus]], [[by train]], [[by taxi]] – בלי [[a]] ובלי [[the]].',
      words: [
        { en: 'bus', he: 'אוטובוס', sound: 'בָּאס' },
        { en: 'train', he: 'רכבת', sound: 'טְרֵיין' },
        { en: 'taxi', he: 'מונית', sound: 'טֶקְסִי' },
        { en: 'ticket', he: 'כרטיס', sound: 'טִיקֶט' },
        { en: 'far', he: 'רחוק', sound: 'פָאר' },
      ],
      sentences: [
        { en: 'I go to work by bus', he: 'אני נוסע לעבודה באוטובוס', heAlt: ['אני נוסעת לעבודה באוטובוס'], errors: ['E3'] },
        { en: 'Is it far?', he: 'זה רחוק?', errors: ['E1', 'E8'] },
        { en: 'One ticket to Haifa, please', he: 'כרטיס אחד לחיפה, בבקשה', alt: ['A ticket to Haifa please'], errors: ['E4'] },
        { en: 'How do I get to the station?', he: 'איך מגיעים לתחנה?', errors: ['E8', 'E14'] },
      ],
    },
    {
      id: 'u7l4',
      title: 'בקניות',
      tip: '[[this]] = זה (קרוב), [[that]] = ההוא (רחוק). ברבים: [[these]] (האלה). [[How much is this?]] אבל [[How much are these?]]',
      words: [
        { en: 'these', he: 'האלה', sound: 'דִ׳יז' },
        { en: 'that', he: 'ההוא', sound: 'דֶ׳ט' },
        { en: 'cheap', he: 'זול', sound: 'צִ׳יפּ' },
        { en: 'expensive', he: 'יקר', sound: 'אִיקְסְפֶּנְסִיב' },
        { en: 'buy', he: 'לקנות', sound: 'בַּאי' },
      ],
      sentences: [
        { en: 'How much are these?', he: 'כמה אלה עולים?', alt: ['How much are those'], errors: ['E1', 'E10'] },
        { en: 'That bag is expensive', he: 'התיק ההוא יקר', alt: ["That bag's expensive"], errors: ['E1', 'E4'] },
        { en: 'These apples are cheap', he: 'התפוחים האלה זולים', errors: ['E1', 'E10'] },
        { en: 'I want to buy this', he: 'אני רוצה לקנות את זה', alt: ["I'd like to buy this", 'I would like to buy this'] },
      ],
    },
    {
      id: 'u7l5',
      title: 'אני יכול',
      tip: 'אחרי [[can]] בא הפועל בלי [[to]]: [[I can swim]], לא [[I can to swim]]. בשלילה: [[can\'t]].',
      words: [
        { en: 'can', he: 'יכול', sound: 'קֶן' },
        { en: 'help', he: 'לעזור', sound: 'הֶלְפּ' },
        { en: 'swim', he: 'לשחות', sound: 'סְוִוים' },
        { en: 'dance', he: 'לרקוד', sound: 'דֶנְס' },
        { en: 'sing', he: 'לשיר', sound: 'סִינְג' },
      ],
      sentences: [
        { en: 'I can swim', he: 'אני יודע לשחות', heAlt: ['אני יודעת לשחות'], errors: ['E27'] },
        { en: 'Can you help me?', he: 'אתה יכול לעזור לי?', heAlt: ['את יכולה לעזור לי?'], errors: ['E8', 'E27'] },
        { en: "She can't sing", he: 'היא לא יודעת לשיר', alt: ['She cannot sing', 'She can not sing'], errors: ['E27'] },
        { en: 'Can I help you?', he: 'אפשר לעזור לך?', errors: ['E27'] },
      ],
    },
    {
      id: 'u7l6',
      title: 'בפנים, על, ליד',
      tip: 'ה־״ב־״ העברית היא כמה מילים באנגלית: [[at the mall]], [[on the bus]], [[in Tel Aviv]].',
      words: [
        { en: 'city', he: 'עיר', sound: 'סִיטִי' },
        { en: 'beach', he: 'חוף', sound: 'בִּיץ׳' },
        { en: 'mall', he: 'קניון', sound: 'מוֹל' },
        { en: 'corner', he: 'פינה', sound: 'קוֹרְנֶר' },
        { en: 'office', he: 'משרד', sound: 'אוֹפִיס' },
      ],
      sentences: [
        { en: 'I am at the mall', he: 'אני בקניון', alt: ["I'm at the mall"], errors: ['E1', 'E15'] },
        { en: 'We are on the bus', he: 'אנחנו באוטובוס', alt: ["We're on the bus"], errors: ['E1', 'E15'] },
        { en: 'Tel Aviv is a big city', he: 'תל אביב היא עיר גדולה', alt: ["Tel Aviv's a big city"], errors: ['E2', 'E4'] },
        { en: 'My office is on the corner', he: 'המשרד שלי בפינה', alt: ["My office's on the corner"], errors: ['E1', 'E15'] },
      ],
    },
  ],
};
