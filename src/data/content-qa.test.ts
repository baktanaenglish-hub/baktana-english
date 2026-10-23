/**
 * QA checks for release v2 content (docs/spec/v2.md §4.0, §5.4, §7.3, US-C2, US-I1 AC4).
 */
import { describe, expect, it } from 'vitest';
import { parseRichTip } from '../components/RichTip';
import { allLessons, allUnits, findLesson } from './course';

/** Every piece of Hebrew tip text the app renders through RichTip. */
function tipTexts(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const unit of allUnits) {
    if (unit.intro) out.push({ where: `${unit.id} intro`, text: unit.intro.tip });
    for (const goal of unit.intro?.goals ?? []) out.push({ where: `${unit.id} goal`, text: goal });
    for (const lesson of unit.lessons) if (lesson.tip) out.push({ where: `${lesson.id} tip`, text: lesson.tip });
  }
  return out;
}

describe('content QA: tips render right in RTL (US-I1 AC4)', () => {
  it('keeps every English fragment of a tip or goal inside [[…]], so it is isolated left-to-right', () => {
    // Regression: "wh-" (u6 goal), "t או d" (u10l2) and "good" (u12l4) were bare Latin text in a
    // right-to-left paragraph – "wh-" at the end of a line rendered as "-wh".
    for (const { where, text } of tipTexts()) {
      const hebrewParts = parseRichTip(text)
        .filter((p) => !p.en)
        .map((p) => p.text)
        .join(' ');
      expect(hebrewParts, where).not.toMatch(/[A-Za-z]/);
    }
  });

  it('closes every [[ with ]]', () => {
    for (const { where, text } of tipTexts()) {
      expect(text.split('[[').length, where).toBe(text.split(']]').length);
    }
  });
});

describe('content QA: §4.0 clean-up of the existing lessons (US-C2 AC3)', () => {
  it('replaces the sentences listed in §4.0 at the same index', () => {
    expect(lesson('u1l1').sentences[0]).toMatchObject({
      en: 'Thanks, goodbye!',
      he: 'תודה, להתראות!',
      alt: expect.arrayContaining(['Thanks goodbye', 'Thank you, goodbye']),
    });
    expect(lesson('u2l2').sentences[2]).toMatchObject({
      en: 'This is my father',
      he: 'זה אבא שלי',
      alt: expect.arrayContaining(['This is my dad']),
    });
    expect(lesson('u4l1').sentences[3]).toMatchObject({
      en: 'Five shekels, please',
      he: 'חמישה שקלים, בבקשה',
      alt: expect.arrayContaining(['Five shekels please']),
      errors: expect.arrayContaining(['E10']),
    });
    expect(lesson('u4l3').sentences[1]).toMatchObject({
      en: 'I have a blue bag',
      he: 'יש לי תיק כחול',
      errors: expect.arrayContaining(['E4', 'E6']),
    });
    expect(lesson('u4l3').sentences[2]).toMatchObject({
      en: 'The small apple is green',
      he: 'התפוח הקטן ירוק',
      alt: expect.arrayContaining(["The small apple's green"]),
      errors: expect.arrayContaining(['E1', 'E4']),
    });
  });

  it('shows "you" as אתה/את, adds Dana alternatives and fixes the transliteration of "question"', () => {
    expect(lesson('u1l2').words.find((w) => w.en === 'you')?.he).toBe('אתה/את');
    expect(lesson('u1l3').sentences[3].alt).toEqual(expect.arrayContaining(["My name's Dana", "I'm Dana", 'I am Dana']));
    expect(lesson('u6l2').words.find((w) => w.en === 'question')?.sound).toBe('קְוֶוסְצ׳ֶן');
  });

  it('adds the feminine heAlt forms listed in §4.0', () => {
    const fem: [string, number, string][] = [
      ['u1l2', 0, 'אני טובה'],
      ['u1l2', 1, 'את טובה'],
      ['u3l1', 1, 'אני אוכלת לחם'],
      ['u3l2', 0, 'אני רעבה'],
      ['u3l2', 1, 'אני אוכלת ביצה'],
      ['u4l2', 1, 'אני בת עשר'],
      ['u5l2', 1, 'אני הולכת לבית הספר'],
      ['u5l2', 2, 'אני ישנה בלילה'],
      ['u5l2', 3, 'אני עובדת בבוקר'],
      ['u5l3', 1, 'אני תמיד אוכלת ארוחת בוקר'],
      ['u6l2', 0, 'את מדברת עברית?'],
      ['u6l2', 1, 'את מבינה?'],
      ['u6l2', 3, 'אני לא יודעת'],
      ['u6l3', 0, 'איפה את גרה?'],
      ['u6l3', 1, 'אני גרה בתל אביב'],
      ['u6l3', 3, 'מתי את עובדת?'],
    ];
    for (const [id, i, he] of fem) expect(lesson(id).sentences[i].heAlt, `${id}:${i}`).toContain(he);
  });
});

describe('content QA: answers', () => {
  it('never accepts an English alternative that changes the meaning ("Is it too late" ≠ "כבר מאוחר?")', () => {
    expect(lesson('u4l5').sentences[3].alt ?? []).not.toContain('Is it too late');
  });

  it('has 64 lessons (US-C2 AC2)', () => {
    expect(allLessons).toHaveLength(64);
  });
});

function lesson(id: string) {
  return findLesson(id)!.lesson;
}
