import { describe, expect, it } from 'vitest';
import { allLessons } from '../data/course';
import type { Exercise, Lesson } from '../types';
import { blankSentence } from './blank';
import { seededRng } from './random';

type Blank = Extract<Exercise, { kind: 'blank' }>;
const lesson = (sentences: string[], words: string[] = []): Lesson => ({
  id: 'u1l1',
  title: 't',
  words: words.map((en) => ({ en, he: en })),
  sentences: sentences.map((en) => ({ en, he: 'עברית' })),
});

describe('blankSentence', () => {
  it('blanks the verb "be" with the other forms as options', () => {
    const ex = blankSentence(lesson(['She is a girl.']), 0, seededRng(1)) as Blank;
    expect(ex.answer).toBe('is');
    expect([...ex.options].sort()).toEqual(['am', 'are', 'is']);
    expect(`${ex.before} ${ex.answer}${ex.after}`).toBe('She is a girl.');
  });

  it('keeps capitals and punctuation around the blank', () => {
    const ex = blankSentence(lesson(['Is he your friend?']), 0, seededRng(1)) as Blank;
    expect(ex.answer).toBe('Is');
    expect(ex.options).toEqual(expect.arrayContaining(['Am', 'Are']));
    expect(ex.before).toBe('');
    expect(ex.after).toBe(' he your friend?');
  });

  it('falls back to a lesson word with other lesson words as options', () => {
    const ex = blankSentence(lesson(['I drink water'], ['water', 'bread', 'milk', 'coffee']), 0, seededRng(2)) as Blank;
    expect(ex.answer).toBe('water');
    expect(ex.options).toHaveLength(4);
    expect(ex.options).toContain('water');
  });

  it('skips sentences without a good word', () => {
    expect(blankSentence(lesson(['Hello and goodbye']), 0, seededRng(1))).toBeUndefined();
  });

  it('works on every course sentence that has a candidate, with the answer among distinct options', () => {
    let count = 0;
    for (const l of allLessons) {
      l.sentences.forEach((s, i) => {
        const ex = blankSentence(l, i, seededRng(i + 1)) as Blank | undefined;
        if (!ex) return;
        count += 1;
        expect(ex.options).toContain(ex.answer);
        expect(new Set(ex.options).size).toBe(ex.options.length);
        expect(`${ex.before}${ex.before ? ' ' : ''}${ex.answer}${ex.after}`).toBe(s.en);
      });
    }
    expect(count).toBeGreaterThan(150);
  });
});
