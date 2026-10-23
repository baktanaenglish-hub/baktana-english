import { describe, expect, it } from 'vitest';
import { validateAuth } from './AuthScreen';
import { reviewButtonState } from './LearningPath';
import { itemAnswers, lessonResult } from './LessonScreen';
import { parseRichTip } from './RichTip';
import type { Exercise } from '../types';

describe('lessonResult', () => {
  it('gives a bonus for a flawless lesson', () => {
    expect(lessonResult(10, 0)).toEqual({ xp: 15, accuracy: 100 });
    expect(lessonResult(10, 5)).toEqual({ xp: 10, accuracy: 67 });
    expect(lessonResult(10, 0, 20).xp).toBe(25);
  });
});

describe('validateAuth', () => {
  it('checks the form fields', () => {
    expect(validateAuth('register', 'a@b.co', '12345678', 'רון')).toBeNull();
    expect(validateAuth('register', 'a@b.co', '12345678', 'ר')).not.toBeNull();
    expect(validateAuth('register', 'not-an-email', '12345678', 'רון')).not.toBeNull();
    expect(validateAuth('register', 'a@b.co', '123', 'רון')).not.toBeNull();
    expect(validateAuth('login', 'a@b.co', '1', '')).toBeNull();
    expect(validateAuth('login', 'a@b.co', '', '')).not.toBeNull();
  });

  // Regression: the form accepted 6–7 character passwords that the server rejects (US-A1 AC1/AC3).
  it('requires the same 8-character minimum as the server', () => {
    expect(validateAuth('register', 'a@b.co', '1234567', 'רון')).toMatch(/8/);
    expect(validateAuth('register', 'a@b.co', '12345678', 'רון')).toBeNull();
  });
});

describe('reviewButtonState (US-R1)', () => {
  it('AC1: nothing due and a completed lesson → "💪 תרגול", enabled, no card', () => {
    expect(reviewButtonState(0, true)).toEqual({ label: '💪 תרגול', disabled: false, pinned: false });
  });

  it('AC2: 2 due → "🧠 חזרה (2)" without a pinned card', () => {
    expect(reviewButtonState(2, true)).toEqual({ label: '🧠 חזרה (2)', disabled: false, pinned: false });
  });

  it('AC3: 3 or more due → the card is pinned', () => {
    expect(reviewButtonState(3, true).pinned).toBe(true);
    expect(reviewButtonState(12, true)).toMatchObject({ label: '🧠 חזרה (12)', pinned: true });
  });

  it('AC4: nothing completed → disabled', () => {
    expect(reviewButtonState(0, false)).toMatchObject({ disabled: true, pinned: false });
  });
});

describe('itemAnswers', () => {
  const match: Exercise = {
    kind: 'match',
    pairs: [
      { en: 'a', he: 'א' },
      { en: 'b', he: 'ב' },
      { en: 'c', he: 'ג' },
    ],
    itemKeys: ['w:a', 'w:b', 'w:c'],
  };

  it('reports one answer per match pair; pairs involved in a wrong match are wrong', () => {
    expect(itemAnswers(match, true, [0, 2])).toEqual([
      { itemKey: 'w:a', correct: false, exType: 'match' },
      { itemKey: 'w:b', correct: true, exType: 'match' },
      { itemKey: 'w:c', correct: false, exType: 'match' },
    ]);
  });

  it('reports choice and build answers with their type and error codes', () => {
    const choice: Exercise = {
      kind: 'choice',
      prompt: 'שלום',
      promptLang: 'he',
      options: ['hello'],
      answer: 'hello',
      itemKey: 'w:hello',
    };
    expect(itemAnswers(choice, false)).toEqual([{ itemKey: 'w:hello', correct: false, exType: 'choice-en' }]);
    const build: Exercise = {
      kind: 'build',
      prompt: 'I am good',
      promptLang: 'en',
      answerLang: 'he',
      bank: [],
      answers: [],
      itemKey: 's:u1l2:0',
      errors: ['E1'],
    };
    expect(itemAnswers(build, true)).toEqual([
      { itemKey: 's:u1l2:0', correct: true, exType: 'build-he', errors: ['E1'] },
    ]);
    expect(itemAnswers({ ...build, itemKey: undefined }, true)).toEqual([]);
  });
});

describe('parseRichTip (US-I1 AC4)', () => {
  it('splits [[English]] fragments out of Hebrew text, keeping their punctuation inside', () => {
    expect(parseRichTip('אומרים [[I am good]] ולא [[I good]].')).toEqual([
      { text: 'אומרים ', en: false },
      { text: 'I am good', en: true },
      { text: ' ולא ', en: false },
      { text: 'I good', en: true },
      { text: '.', en: false },
    ]);
    expect(parseRichTip('שאלה: [[Does he like…?]]')).toEqual([
      { text: 'שאלה: ', en: false },
      { text: 'Does he like…?', en: true },
    ]);
  });

  it('keeps plain text and unclosed brackets as they are', () => {
    expect(parseRichTip('רק עברית')).toEqual([{ text: 'רק עברית', en: false }]);
    expect(parseRichTip('פתוח [[oops')).toEqual([{ text: 'פתוח [[oops', en: false }]);
    expect(parseRichTip('')).toEqual([]);
  });
});
