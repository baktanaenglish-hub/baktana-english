import type { Unit } from '../../types';

/**
 * Unit 4. Owner: content-b (see docs/spec/v2.md §10 and README.md here).
 * Existing lesson ids keep their place; new lessons are appended at the end of the unit.
 */
export const unit4: Unit = {
  id: 'u4',
  title: 'יחידה 4: מספרים, צבעים וזמן',
  description: 'סופרים עד 100, צבעים, שעות וימים',
  color: '#ce82ff',
  level: 'A1',
  intro: {
    tip: "אחרי מספר גדול מאחד מוסיפים [[s]]: [[two brothers]]. גיל אומרים עם [[am / is]]: [[I am ten]]. שעה עם [[at]], יום עם [[on]], חודש עם [[in]]: [[at seven]], [[on Sunday]], [[in July]].",
    goals: ["לספור עד 100", "לתאר צבעים", "להגיד שעה, יום ותאריך"],
  },
  lessons: [
    {
      id: 'u4l1',
      title: 'אחת, שתיים, שלוש',
      words: [
        { en: 'one', he: 'אחת', sound: 'וָואן' },
        { en: 'two', he: 'שתיים', sound: 'טוּ' },
        { en: 'three', he: 'שלוש', sound: 'ת׳רִי' },
        { en: 'four', he: 'ארבע', sound: 'פוֹר' },
        { en: 'five', he: 'חמש', sound: 'פַייב' },
      ],
      sentences: [
        { en: 'One coffee, please', he: 'קפה אחד, בבקשה', errors: ['E10'] },
        { en: 'I have two brothers', he: 'יש לי שני אחים', errors: ['E6', 'E10'] },
        { en: 'I have three apples', he: 'יש לי שלושה תפוחים', errors: ['E6', 'E10', 'E11'] },
        { en: 'Five shekels, please', he: 'חמישה שקלים, בבקשה', alt: ['Five shekels please'], errors: ['E10'] },
      ],
    },
    {
      id: 'u4l2',
      title: 'בן כמה אתה?',
      words: [
        { en: 'six', he: 'שש', sound: 'סִיקס' },
        { en: 'seven', he: 'שבע', sound: 'סֶבֶן' },
        { en: 'eight', he: 'שמונה', sound: 'אֵייט' },
        { en: 'nine', he: 'תשע', sound: 'נַיין' },
        { en: 'ten', he: 'עשר', sound: 'טֶן' },
      ],
      sentences: [
        { en: 'How old are you?', he: 'בן כמה אתה?', heAlt: ['בת כמה את?'], errors: ['E1', 'E14'] },
        {
          en: 'I am ten years old',
          he: 'אני בן עשר',
          alt: ["I'm ten years old", 'I am ten', "I'm ten"],
          heAlt: ['אני בת עשר'],
          errors: ['E1', 'E5'],
        },
        {
          en: 'She is eight years old',
          he: 'היא בת שמונה',
          alt: ["She's eight years old", 'She is eight', "She's eight"],
          errors: ['E1', 'E5'],
        },
        {
          en: 'My brother is seven',
          he: 'אחי בן שבע',
          alt: ['My brother is seven years old', "My brother's seven"],
          errors: ['E1', 'E5'],
        },
      ],
    },
    {
      id: 'u4l3',
      title: 'צבעים',
      words: [
        { en: 'red', he: 'אדום', sound: 'רֶד' },
        { en: 'blue', he: 'כחול', sound: 'בּלוּ' },
        { en: 'green', he: 'ירוק', sound: 'גרִין' },
        { en: 'yellow', he: 'צהוב', sound: 'יֶלוֹ' },
        { en: 'black', he: 'שחור', sound: 'בּלֶק' },
      ],
      sentences: [
        { en: 'The apple is red', he: 'התפוח אדום', alt: ["The apple's red"], errors: ['E1'] },
        { en: 'I have a blue bag', he: 'יש לי תיק כחול', errors: ['E4', 'E6'] },
        {
          en: 'The small apple is green',
          he: 'התפוח הקטן ירוק',
          alt: ["The small apple's green"],
          errors: ['E1', 'E4'],
        },
        {
          en: 'What color is it?',
          he: 'איזה צבע זה?',
          alt: ['What colour is it', 'What color is this'],
          errors: ['E14'],
        },
      ],
    },
    {
      id: 'u4l4',
      title: 'מ־11 עד 100',
      tip: 'גיל אומרים עם [[am / is]], לא עם [[have]]: [[I am twelve]]. ב־[[thirty]] ה־[[th]] נהגה עם הלשון בין השיניים – לא "טרטי".',
      words: [
        { en: 'eleven', he: 'אחת עשרה', sound: 'אִילֶבֶן' },
        { en: 'twelve', he: 'שתים עשרה', sound: 'טְוֶולְב' },
        { en: 'twenty', he: 'עשרים', sound: 'טְוֶונְטִי' },
        { en: 'thirty', he: 'שלושים', sound: 'ת׳ֶרְטִי' },
        { en: 'hundred', he: 'מאה', sound: 'הָאנְדְרֶד' },
      ],
      sentences: [
        {
          en: 'I am twelve years old',
          he: 'אני בן שתים עשרה',
          alt: ["I'm twelve years old", 'I am twelve', "I'm twelve"],
          heAlt: ['אני בת שתים עשרה'],
          errors: ['E1', 'E5'],
        },
        { en: 'It is thirty shekels', he: 'זה שלושים שקלים', alt: ["It's thirty shekels"], errors: ['E10', 'E11'] },
        { en: 'Twenty or thirty?', he: 'עשרים או שלושים?', errors: ['E11'] },
        {
          en: 'A hundred shekels, please',
          he: 'מאה שקלים, בבקשה',
          alt: ['One hundred shekels please'],
          errors: ['E10'],
        },
      ],
    },
    {
      id: 'u4l5',
      title: 'מה השעה?',
      tip: 'על שעה מדברים עם [[it]], גם כשבעברית אין נושא: [[It is seven]] = השעה שבע. [[half past eight]] = שמונה וחצי.',
      words: [
        { en: 'time', he: 'שעה', sound: 'טַיים' },
        { en: "o'clock", he: 'בדיוק', sound: 'אוֹ קְלוֹק' },
        { en: 'half', he: 'חצי', sound: 'הָאף' },
        { en: 'minute', he: 'דקה', sound: 'מִינִיט' },
        { en: 'early', he: 'מוקדם', sound: 'אֶרְלִי' },
      ],
      sentences: [
        { en: 'What time is it?', he: 'מה השעה?', errors: ['E14'] },
        {
          en: "It is seven o'clock",
          he: 'השעה שבע',
          alt: ["It's seven o'clock", 'It is seven', "It's seven"],
          errors: ['E1'],
        },
        { en: 'It is half past eight', he: 'השעה שמונה וחצי', alt: ["It's half past eight"], errors: ['E1'] },
        {
          en: 'Is it late?',
          he: 'כבר מאוחר?',
          alt: ['Is it late already'],
          errors: ['E1', 'E8'],
        },
      ],
    },
    {
      id: 'u4l6',
      title: 'ימים וחודשים',
      tip: 'יום עם [[on]] וחודש עם [[in]]: [[on Sunday]], [[in July]]. ימים וחודשים כותבים תמיד באות גדולה.',
      words: [
        { en: 'Sunday', he: 'יום ראשון', sound: 'סָאנְדֵיי' },
        { en: 'Friday', he: 'יום שישי', sound: 'פְרַיידֵיי' },
        { en: 'Saturday', he: 'שבת', sound: 'סֶטֶרְדֵיי' },
        { en: 'month', he: 'חודש', sound: 'מָאנְת׳' },
        { en: 'birthday', he: 'יום הולדת', sound: 'בֶּרְת׳דֵיי' },
      ],
      sentences: [
        {
          en: 'I work on Sunday',
          he: 'אני עובד ביום ראשון',
          alt: ['I work on Sundays'],
          heAlt: ['אני עובדת ביום ראשון'],
          errors: ['E15'],
        },
        {
          en: 'My birthday is in July',
          he: 'יום ההולדת שלי ביולי',
          alt: ["My birthday's in July"],
          errors: ['E1', 'E15'],
        },
        { en: 'See you on Friday', he: 'נתראה ביום שישי', alt: ['See you Friday'], errors: ['E15'] },
        { en: 'What day is it today?', he: 'איזה יום היום?', alt: ['What day is today'], errors: ['E14'] },
      ],
    },
  ],
};
