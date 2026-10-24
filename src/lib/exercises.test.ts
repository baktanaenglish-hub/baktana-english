import { describe, expect, it } from 'vitest';
import { checkTyped } from './typing';
import { isItemKey, sentenceKey, wordKey } from '../../shared/item-keys';
import { allLessons, course } from '../data/course';
import type { Exercise, Lesson } from '../types';
import { isCorrect, tokenize } from './answer';
import { buildSentence, exerciseType, generateExercises, markNewWords, tileLabel, withoutSpeaking } from './exercises';
import { seededRng } from './random';

/** True when `answer` can be laid out from the bank's tiles (each tile used once). */
function buildable(bank: readonly string[], answer: string): boolean {
  const left = [...bank];
  for (const tile of tokenize(answer)) {
    const i = left.indexOf(tile);
    if (i === -1) return false;
    left.splice(i, 1);
  }
  return true;
}

describe('speaking exercises', () => {
  it('asks to say two of the lesson sentences, and can be left out', () => {
    for (const lesson of allLessons) {
      const exercises = generateExercises(lesson, seededRng(5));
      const speak = exercises.filter((e) => e.kind === 'speak');
      expect(speak).toHaveLength(Math.min(2, lesson.sentences.length));
      expect(new Set(speak.map((e) => e.prompt)).size).toBe(speak.length);
      expect(withoutSpeaking(exercises)).toHaveLength(exercises.length - speak.length);
      expect(withoutSpeaking(exercises).some((e) => e.kind === 'speak')).toBe(false);
    }
  });
});

describe('course data', () => {
  it('has unique lesson ids and enough words for every lesson', () => {
    const ids = allLessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const unit of course) expect(unit.lessons.length).toBeGreaterThan(0);
    for (const lesson of allLessons) {
      expect(lesson.words.length).toBeGreaterThanOrEqual(4);
      expect(new Set(lesson.words.map((w) => w.en)).size).toBe(lesson.words.length);
      expect(new Set(lesson.words.map((w) => w.he)).size).toBe(lesson.words.length);
    }
  });
});

describe('generateExercises', () => {
  for (const lesson of allLessons) {
    it(`builds solvable exercises for ${lesson.id}`, () => {
      const exercises = generateExercises(lesson, seededRng(42));
      expect(exercises.length).toBeGreaterThan(lesson.words.length);
      for (const ex of exercises) {
        if (ex.kind === 'choice') {
          expect(ex.options).toContain(ex.answer);
          expect(new Set(ex.options).size).toBe(ex.options.length);
        } else if (ex.kind === 'build') {
          // The primary answer must be buildable from the bank's tiles.
          const bank = [...ex.bank];
          const tiles = tokenize(ex.answers[0]);
          for (const tile of tiles) {
            const i = bank.indexOf(tile);
            expect(i, `missing tile "${tile}"`).toBeGreaterThanOrEqual(0);
            bank.splice(i, 1);
          }
          expect(isCorrect(tiles.join(' '), ex.answers)).toBe(true);
        } else if (ex.kind === 'blank') {
          expect(ex.options).toContain(ex.answer);
        } else if (ex.kind === 'type') {
          expect(checkTyped(ex.answers[0], ex.answers).kind).toBe('correct');
        } else if (ex.kind === 'speak') {
          expect(lesson.sentences.map((s) => s.en)).toContain(ex.prompt);
          expect(ex.answers[0]).toBe(ex.prompt);
        } else {
          expect(ex.pairs.length).toBeGreaterThanOrEqual(4);
        }
      }
    });
  }

  it('is deterministic with a seeded rng', () => {
    const lesson = allLessons[0];
    expect(generateExercises(lesson, seededRng(7))).toEqual(generateExercises(lesson, seededRng(7)));
  });
});

describe('item keys and heAlt (v2 §7.5)', () => {
  it('every generated exercise in every lesson but speaking carries valid item keys', () => {
    for (const lesson of allLessons) {
      for (const ex of generateExercises(lesson, seededRng(13))) {
        if (ex.kind === 'match') {
          expect(ex.itemKeys).toHaveLength(ex.pairs.length);
          ex.pairs.forEach((pair, i) => expect(ex.itemKeys![i]).toBe(wordKey(pair)));
          for (const key of ex.itemKeys!) expect(isItemKey(key), key).toBe(true);
        } else if (ex.kind === 'speak') {
          expect(ex.itemKey).toBeUndefined();
        } else {
          expect(isItemKey(ex.itemKey), `${lesson.id}: ${ex.itemKey}`).toBe(true);
        }
      }
    }
  });

  it('choice keys point at the word, build keys at the sentence index, with its error codes', () => {
    const lesson = allLessons.find((l) => l.sentences.some((s) => s.errors?.length)) ?? allLessons[0];
    for (const ex of generateExercises(lesson, seededRng(3))) {
      if (ex.kind === 'choice') {
        const word = lesson.words.find((w) => w.en === ex.answer || w.he === ex.answer)!;
        expect(ex.itemKey).toBe(wordKey(word));
      }
      if (ex.kind === 'build') {
        const index = lesson.sentences.findIndex((s) => s.en === ex.prompt || s.he === ex.prompt);
        expect(ex.itemKey).toBe(sentenceKey(lesson.id, index));
        expect(ex.errors).toEqual(lesson.sentences[index].errors?.length ? lesson.sentences[index].errors : undefined);
      }
    }
  });

  it('US-G1: a Hebrew build accepts every heAlt, and the first one is buildable from the bank', () => {
    let checked = 0;
    for (const lesson of allLessons) {
      lesson.sentences.forEach((sentence, i) => {
        if (!sentence.heAlt?.length) return;
        const ex = buildSentence(lesson, i, 'he', seededRng(i + 1));
        if (ex.kind !== 'build') throw new Error('expected build');
        expect(ex.answers).toEqual([sentence.he, ...sentence.heAlt]);
        expect(buildable(ex.bank, sentence.he), `${lesson.id}:${i} he`).toBe(true);
        expect(buildable(ex.bank, sentence.heAlt[0]), `${lesson.id}:${i} heAlt`).toBe(true);
        for (const alt of sentence.heAlt) expect(isCorrect(alt, ex.answers)).toBe(true);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('US-G1 AC1/AC2: "אני שמחה" is in the bank and accepted for "I am happy"', () => {
    const lesson: Lesson = {
      id: 'u2l1',
      title: 'test',
      words: [],
      sentences: [{ en: 'I am happy', he: 'אני שמח', heAlt: ['אני שמחה'] }],
    };
    const ex = buildSentence(lesson, 0, 'he', seededRng(1));
    if (ex.kind !== 'build') throw new Error('expected build');
    expect(ex.bank).toContain('שמחה');
    expect(ex.bank).toContain('שמח');
    expect(isCorrect('אני שמחה', ex.answers)).toBe(true);
  });

  it('maps exercises to analytics types', () => {
    const base = { prompt: 'x', options: ['x'], answer: 'x' };
    const build = { kind: 'build' as const, prompt: 'x', bank: [], answers: [] };
    const cases: [Exercise, string][] = [
      [{ kind: 'choice', promptLang: 'he', ...base }, 'choice-en'],
      [{ kind: 'choice', promptLang: 'en', ...base }, 'choice-he'],
      [{ kind: 'match', pairs: [] }, 'match'],
      [{ ...build, promptLang: 'en', answerLang: 'en', listen: true }, 'listen'],
      [{ ...build, promptLang: 'he', answerLang: 'en' }, 'build-en'],
      [{ ...build, promptLang: 'en', answerLang: 'he' }, 'build-he'],
      [{ kind: 'speak', prompt: 'x', he: 'x', answers: ['x'] }, 'speak'],
    ];
    for (const [ex, type] of cases) expect(exerciseType(ex)).toBe(type);
  });
});

describe('markNewWords', () => {
  it('marks only the word questions about words the learner never answered', () => {
    const lesson = allLessons[0];
    const exercises = generateExercises(lesson, seededRng(3));
    const known = wordKey(lesson.words[0]);
    const marked = markNewWords(exercises, (key) => key === known);
    const choices = marked.filter((e) => e.kind === 'choice');
    expect(choices.length).toBe(lesson.words.length);
    for (const e of choices) expect(e.newWord ?? false).toBe(e.itemKey !== known);
    expect(marked.filter((e) => e.kind !== 'choice')).toEqual(exercises.filter((e) => e.kind !== 'choice'));
  });

  it('marks nothing once every word is known', () => {
    const exercises = generateExercises(allLessons[0], seededRng(3));
    expect(markNewWords(exercises, () => true)).toEqual(exercises);
  });
});

describe('tileLabel', () => {
  it('hides a capital that only starts the sentence', () => {
    expect(tileLabel('Thanks')).toBe('thanks');
    expect(tileLabel('Yes')).toBe('yes');
    expect(tileLabel('hello')).toBe('hello');
  });

  it('keeps "I" and names', () => {
    expect(tileLabel('I')).toBe('I');
    expect(tileLabel('Xylophonia')).toBe('Xylophonia');
  });
});
