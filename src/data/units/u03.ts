import type { Unit } from '../../types';

/**
 * Unit 3. Owner: content-a (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit3: Unit = {
  id: 'u3',
  title: 'יחידה 3: אוכל ושתייה',
  description: 'מזמינים, אוהבים ומשלמים',
  color: '#ff9600',
  level: 'A1',
  intro: {
    tip: "לפני צליל תנועה אומרים [[an]]: [[an apple]], [[an egg]]. בבית קפה מבקשים בנימוס עם [[Can I have…?]] או [[I'd like…]] – זה נשמע טבעי יותר מ־[[I want]].",
    goals: ["להזמין אוכל ושתייה", "להגיד מה אני אוהב ומה לא", "לשאול כמה זה עולה"],
  },
  lessons: [
    {
      id: 'u3l1',
      title: 'ארוחת בוקר',
      words: [
        { en: 'water', he: 'מים', sound: 'ווֹטֶר' },
        { en: 'bread', he: 'לחם', sound: 'בּרֶד' },
        { en: 'apple', he: 'תפוח', sound: 'אֶפֶּל' },
        { en: 'milk', he: 'חלב', sound: 'מִילק' },
        { en: 'coffee', he: 'קפה', sound: 'קוֹפִי' },
      ],
      sentences: [
        { en: 'I drink water', he: 'אני שותה מים', errors: ['E12'] },
        { en: 'I eat bread', he: 'אני אוכל לחם', heAlt: ['אני אוכלת לחם'] },
        { en: 'Coffee with milk, please', he: 'קפה עם חלב, בבקשה' },
      ],
    },
    {
      id: 'u3l2',
      title: 'אני רעב!',
      words: [
        { en: 'rice', he: 'אורז', sound: 'רַייס' },
        { en: 'chicken', he: 'עוף', sound: 'צִ׳יקֶן' },
        { en: 'egg', he: 'ביצה', sound: 'אֶג' },
        { en: 'tea', he: 'תה', sound: 'טִי' },
        { en: 'hungry', he: 'רעב', sound: 'הָאנגרִי' },
      ],
      sentences: [
        { en: 'I am hungry', he: 'אני רעב', alt: ["I'm hungry"], heAlt: ['אני רעבה'], errors: ['E1'] },
        { en: 'I eat an egg', he: 'אני אוכל ביצה', heAlt: ['אני אוכלת ביצה'], errors: ['E2'] },
        { en: 'Tea or coffee?', he: 'תה או קפה?' },
        { en: 'I want rice and chicken', he: 'אני רוצה אורז ועוף' },
      ],
    },
    {
      id: 'u3l3',
      title: 'בבית הקפה',
      tip: "כדי להזמין בנימוס אומרים [[Can I have…?]] או [[I'd like…]] (= [[I would like]]). [[I want]] נשמע ישיר מדי.",
      words: [
        { en: 'cake', he: 'עוגה', sound: 'קֵייק' },
        { en: 'juice', he: 'מיץ', sound: 'ג׳וּס' },
        { en: 'sandwich', he: 'כריך', sound: 'סֶנְדְוִויץ׳' },
        { en: 'menu', he: 'תפריט', sound: 'מֶנְיוּ' },
        { en: 'glass', he: 'כוס', sound: 'גְלָאס' },
      ],
      sentences: [
        {
          en: 'Can I have a coffee, please?',
          he: 'אפשר לקבל קפה, בבקשה?',
          alt: ['Can I have coffee please', 'Could I have a coffee please'],
          errors: ['E2', 'E8'],
        },
        { en: "I'd like a glass of water", he: 'הייתי רוצה כוס מים', alt: ['I would like a glass of water'], errors: ['E2'] },
        { en: 'The menu, please', he: 'את התפריט, בבקשה', alt: ['Menu please'], errors: ['E3'] },
        { en: 'Is the cake good?', he: 'העוגה טובה?', errors: ['E1', 'E8'] },
      ],
    },
    {
      id: 'u3l4',
      title: 'אוהב או לא אוהב?',
      tip: "בשלילה אומרים [[I don't like]] – לא [[I not like]]. כשמסכימים: [[Me too!]] (גם אני!).",
      words: [
        { en: 'pizza', he: 'פיצה', sound: 'פִּיצָה' },
        { en: 'falafel', he: 'פלאפל', sound: 'פָלָאפֶל' },
        { en: 'sweet', he: 'מתוק', sound: 'סְוִויט' },
        { en: 'delicious', he: 'טעים', sound: 'דִילִישֶס' },
        { en: 'too', he: 'גם', sound: 'טוּ' },
      ],
      sentences: [
        { en: 'I love pizza', he: 'אני ממש אוהב פיצה', heAlt: ['אני ממש אוהבת פיצה'] },
        { en: "I don't like salad", he: 'אני לא אוהב סלט', alt: ['I do not like salad'], heAlt: ['אני לא אוהבת סלט'], errors: ['E8'] },
        { en: 'Falafel is delicious', he: 'פלאפל זה טעים', alt: ["Falafel's delicious"], errors: ['E1'] },
        { en: 'I like sweet tea. Me too!', he: 'אני אוהב תה מתוק. גם אני!', heAlt: ['אני אוהבת תה מתוק. גם אני!'], errors: ['E4'] },
      ],
    },
    {
      id: 'u3l5',
      title: 'כמה זה עולה?',
      tip: 'שואלים מחיר עם [[How much is it?]]. אחרי מספר גדול מאחד מוסיפים [[s]]: [[one shekel]], [[ten shekels]].',
      words: [
        { en: 'breakfast', he: 'ארוחת בוקר', sound: 'בְּרֶקְפַסְט' },
        { en: 'lunch', he: 'ארוחת צהריים', sound: 'לָאנְץ׳' },
        { en: 'dinner', he: 'ארוחת ערב', sound: 'דִינֶר' },
        { en: 'shekel', he: 'שקל', sound: 'שֶקֶל' },
        { en: 'price', he: 'מחיר', sound: 'פְּרַייס' },
      ],
      sentences: [
        { en: 'How much is it?', he: 'כמה זה עולה?', alt: ['How much is this'], errors: ['E1'] },
        { en: 'It is ten shekels', he: 'זה עשרה שקלים', alt: ["It's ten shekels"], errors: ['E1', 'E10'] },
        { en: 'Dinner is ready', he: 'ארוחת הערב מוכנה', alt: ["Dinner's ready"], errors: ['E1', 'E3'] },
        { en: 'What is for lunch?', he: 'מה יש לצהריים?', alt: ["What's for lunch"], errors: ['E1'] },
      ],
    },
  ],
};
