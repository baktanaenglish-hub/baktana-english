/**
 * Checks for the units written by content-a (docs/spec/v2.md §5.2, §10): u1, u2, u3, u7, u8, u9.
 * Every lesson must produce solvable exercises and keep its words and ids unique.
 */
import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../lib/typing';
import { wordId } from '../../../shared/item-keys';
import { isCorrect, tokenize } from '../../lib/answer';
import { generateExercises } from '../../lib/exercises';
import { isSpokenCorrectly } from '../../lib/spoken';
import { seededRng } from '../../lib/random';
import { allLessons } from '../course';
import { unit1 } from './u01';
import { unit2 } from './u02';
import { unit3 } from './u03';
import { unit7 } from './u07';
import { unit8 } from './u08';
import { unit9 } from './u09';

const units = [unit1, unit2, unit3, unit7, unit8, unit9];
const lessons = units.flatMap((u) => u.lessons);

/** The lesson list from docs/spec/v2.md §4 for these units, in order. */
const EXPECTED_IDS: Record<string, number> = { u1: 5, u2: 5, u3: 5, u7: 6, u8: 6, u9: 5 };

/** English that has a common contracted form, so the sentence needs an `alt`. */
const CONTRACTIBLE =
  /\b(i am|you are|he is|she is|it is|we are|they are|there is|what is|where is|is not|are not|do not|does not|can not|cannot)\b(?=\s+\w)|\w'\w/i;

describe('content-a units: structure', () => {
  it('has every lesson from the spec, numbered in order', () => {
    for (const unit of units) {
      const expected = Array.from({ length: EXPECTED_IDS[unit.id] }, (_, i) => `${unit.id}l${i + 1}`);
      expect(unit.lessons.map((l) => l.id)).toEqual(expected);
    }
  });

  it('gives every lesson 5 words with unique en/he and a transliteration, and 3–4 sentences', () => {
    for (const lesson of lessons) {
      expect(lesson.words.length, lesson.id).toBe(5);
      expect(new Set(lesson.words.map((w) => w.en.toLowerCase())).size, lesson.id).toBe(5);
      expect(new Set(lesson.words.map((w) => w.he)).size, lesson.id).toBe(5);
      for (const w of lesson.words) expect(w.sound?.trim(), `${lesson.id} ${w.en}`).toBeTruthy();
      expect(lesson.sentences.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.sentences.length, lesson.id).toBeLessThanOrEqual(4);
    }
  });

  it('uses each lesson id, word id and Hebrew word only once in the whole course', () => {
    const ids = allLessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of lessons) expect(ids, lesson.id).toContain(lesson.id);

    const words = new Map<string, string>();
    const hebrew = new Map<string, string>();
    for (const lesson of allLessons) {
      for (const w of lesson.words) {
        expect(words.get(wordId(w)), `${wordId(w)} in ${lesson.id}`).toBeUndefined();
        expect(hebrew.get(w.he), `${w.he} in ${lesson.id}`).toBeUndefined();
        words.set(wordId(w), lesson.id);
        hebrew.set(w.he, lesson.id);
      }
    }
  });

  it('accepts the contracted or full form of every sentence that has one', () => {
    for (const lesson of lessons) {
      for (const s of lesson.sentences) {
        if (CONTRACTIBLE.test(s.en)) expect(s.alt?.length ?? 0, `${lesson.id} "${s.en}" needs an alt`).toBeGreaterThan(0);
      }
    }
  });

  it('never leaves an empty errors list', () => {
    for (const lesson of lessons) {
      for (const s of lesson.sentences) if (s.errors) expect(s.errors.length, `${lesson.id} "${s.en}"`).toBeGreaterThan(0);
    }
  });
});

describe('content-a units: exercises', () => {
  for (const lesson of lessons) {
    it(`builds solvable exercises for ${lesson.id}`, () => {
      for (const seed of [1, 7, 42, 1234]) {
        const exercises = generateExercises(lesson, seededRng(seed));
        expect(exercises.length).toBeGreaterThan(lesson.words.length);
        for (const ex of exercises) {
          if (ex.kind === 'choice') {
            expect(ex.options).toContain(ex.answer);
            expect(new Set(ex.options).size).toBe(ex.options.length);
          } else if (ex.kind === 'build') {
            const bank = [...ex.bank];
            const tiles = tokenize(ex.answers[0]);
            for (const tile of tiles) {
              const i = bank.indexOf(tile);
              expect(i, `${lesson.id}: missing tile "${tile}"`).toBeGreaterThanOrEqual(0);
              bank.splice(i, 1);
            }
            expect(isCorrect(tiles.join(' '), ex.answers)).toBe(true);
          } else if (ex.kind === 'blank') {
            expect(ex.options).toContain(ex.answer);
          } else if (ex.kind === 'type') {
            expect(checkTyped(ex.answers[0], ex.answers).kind).toBe('correct');
          } else if (ex.kind === 'speak') {
            expect(isSpokenCorrectly([ex.prompt], ex.answers)).toBe(true);
          } else {
            expect(ex.pairs.length).toBeGreaterThanOrEqual(4);
          }
        }
      }
    });
  }
});
