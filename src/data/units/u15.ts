import type { Unit } from '../../types';

/** Unit 15 (added after v2): nature and trips in Israel. Same rules as the other units (see README.md). */
export const unit15: Unit = {
  id: 'u15',
  title: 'יחידה 15: טבע וטיולים',
  description: 'נופים, חיות, ציוד לטיול, בטיחות ועונות השנה',
  color: '#66a80f',
  level: 'A2',
  intro: {
    tip: 'מתארים נוף עם [[There is]] / [[There are]]: [[There is a mountain]], [[There are two rivers]]. ומזהירים עם [[Be careful!]] – ולא [[Be carefully]].',
    goals: ['לתאר נוף ולדבר על חיות', 'לארוז ציוד לטיול', 'להזהיר ולדבר על עונות השנה'],
  },
  lessons: [
    {
      id: 'u15l1',
      title: 'נוף',
      tip: 'באנגלית אומרים [[in the desert]], [[in the forest]], [[on the mountain]] ו־[[at the sea]]. מתארים עם [[There is]].',
      words: [
        { en: 'mountain', he: 'הר', sound: 'מַאוּנְטֶן' },
        { en: 'sea', he: 'ים', sound: 'סִי' },
        { en: 'desert', he: 'מדבר', sound: 'דֶזֶרְט' },
        { en: 'forest', he: 'יער', sound: 'פוֹרֶסְט' },
        { en: 'river', he: 'נהר', sound: 'רִיבֶר' },
      ],
      sentences: [
        { en: 'There is a mountain here', he: 'יש כאן הר', errors: ['E2', 'E6'] },
        { en: 'The sea is blue', he: 'הים כחול', errors: ['E1'] },
        { en: 'It is hot in the desert', he: 'חם במדבר', alt: ["It's hot in the desert"], errors: ['E1', 'E15'] },
        { en: 'There is a river in the forest', he: 'יש נהר ביער', errors: ['E2', 'E6', 'E15'] },
      ],
    },
    {
      id: 'u15l2',
      title: 'חיות',
      tip: 'חיה אחת: [[a dog]]; כמה חיות: [[two dogs]] עם [[s]]. אבל [[bird]] ו־[[horse]] הן כמו כל שם עצם: [[a bird]], [[two horses]].',
      words: [
        { en: 'dog', he: 'כלב', sound: 'דוֹג' },
        { en: 'cat', he: 'חתול', sound: 'קָאט' },
        { en: 'bird', he: 'ציפור', sound: 'בֶּרְד' },
        { en: 'horse', he: 'סוס', sound: 'הוֹרְס' },
        { en: 'animal', he: 'חיה', sound: 'אָנִימֶל' },
      ],
      sentences: [
        { en: 'I have a dog', he: 'יש לי כלב', errors: ['E2', 'E6'] },
        { en: 'My cat is small', he: 'החתול שלי קטן', alt: ["My cat's small"], errors: ['E1'] },
        { en: 'The bird is on the tree', he: 'הציפור על העץ', errors: ['E1', 'E15'] },
        { en: 'I love animals', he: 'אני אוהב חיות', heAlt: ['אני אוהבת חיות'], errors: ['E10'] },
      ],
    },
    {
      id: 'u15l3',
      title: 'ציוד לטיול',
      tip: 'מה לוקחים? [[I take a map]]. מה צריך? [[I need a tent]] – תמיד עם [[a]] לפני שם עצם יחיד.',
      words: [
        { en: 'map', he: 'מפה', sound: 'מַאפּ' },
        { en: 'tent', he: 'אוהל', sound: 'טֶנְט' },
        { en: 'backpack', he: 'תרמיל', sound: 'בַּקְפַּאק' },
        { en: 'camera', he: 'מצלמה', sound: 'קָמֶרָה' },
        { en: 'flashlight', he: 'פנס', sound: 'פְלַאשְׁלַייט' },
      ],
      sentences: [
        { en: 'I need a map', he: 'אני צריך מפה', heAlt: ['אני צריכה מפה'], errors: ['E2'] },
        { en: 'We have a tent', he: 'יש לנו אוהל', errors: ['E2', 'E6'] },
        { en: 'My backpack is heavy', he: 'התרמיל שלי כבד', alt: ["My backpack's heavy"], errors: ['E1'] },
        { en: 'Take a camera and a flashlight', he: 'קח מצלמה ופנס', heAlt: ['קחי מצלמה ופנס'], errors: ['E2'] },
      ],
    },
    {
      id: 'u15l4',
      title: 'זהירות בטבע',
      tip: 'מזהירים עם [[Be careful!]] – שם תואר אחרי [[be]], לא [[carefully]]. ועם שמש מרבה ללבוש כובע: [[Wear a hat]].',
      words: [
        { en: 'dangerous', he: 'מסוכן', sound: 'דֵייְנְג׳רֶס' },
        { en: 'careful', he: 'זהיר', sound: 'קֶרְפוּל' },
        { en: 'sun', he: 'שמש', sound: 'סָאן' },
        { en: 'hat', he: 'כובע', sound: 'הָאט' },
        { en: 'bottle', he: 'בקבוק', sound: 'בּוֹטֶל' },
      ],
      sentences: [
        { en: 'Be careful, it is dangerous', he: 'היזהר, זה מסוכן', heAlt: ['היזהרי, זה מסוכן'], alt: ["Be careful, it's dangerous"], errors: ['E1'] },
        { en: 'The sun is hot', he: 'השמש חמה', alt: ["The sun's hot"], errors: ['E1'] },
        { en: 'Wear a hat', he: 'תלבש כובע', heAlt: ['תלבשי כובע'], errors: ['E2'] },
        { en: 'I have a bottle of water', he: 'יש לי בקבוק מים', errors: ['E2', 'E6'] },
      ],
    },
    {
      id: 'u15l5',
      title: 'עונות השנה',
      tip: 'אומרים [[in winter]], [[in spring]], [[in summer]] – עם [[in]] ובלי [[the]]. ובישראל: [[It is cold in winter]].',
      words: [
        { en: 'winter', he: 'חורף', sound: 'וִינְטֶר' },
        { en: 'spring', he: 'אביב', sound: 'סְפְּרִינְג' },
        { en: 'autumn', he: 'סתיו', sound: 'אוֹטֶם' },
        { en: 'season', he: 'עונה', sound: 'סִיזֶן' },
        { en: 'snow', he: 'שלג', sound: 'סְנוֹ' },
      ],
      sentences: [
        { en: 'It is cold in winter', he: 'קר בחורף', alt: ["It's cold in winter"], errors: ['E1', 'E3', 'E15'] },
        { en: 'I love spring', he: 'אני אוהב את האביב', heAlt: ['אני אוהבת את האביב'], errors: ['E3'] },
        { en: 'There is snow on the mountain', he: 'יש שלג על ההר', alt: ["There's snow on the mountain"], errors: ['E6', 'E15'] },
        { en: 'What is your favorite season?', he: 'מהי העונה האהובה עליך?', alt: ["What's your favorite season"], errors: ['E14'] },
      ],
    },
  ],
};
