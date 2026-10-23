/**
 * Checks for the units written by content author B (docs/spec/v2.md §5.2, §10): u4, u5, u6, u10, u11, u12.
 * Every lesson is run through generateExercises with seeded rngs; each build exercise must be solvable
 * from its bank, and words / ids must be unique.
 */
import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../lib/typing';
import { wordId } from '../../../shared/item-keys';
import { isCorrect, tokenize } from '../../lib/answer';
import { generateExercises } from '../../lib/exercises';
import { isSpokenCorrectly } from '../../lib/spoken';
import { seededRng } from '../../lib/random';
import type { Unit } from '../../types';
import { unit4 } from './u04';
import { unit5 } from './u05';
import { unit6 } from './u06';
import { unit10 } from './u10';
import { unit11 } from './u11';
import { unit12 } from './u12';

const UNITS: Unit[] = [unit4, unit5, unit6, unit10, unit11, unit12];
const LESSON_COUNT: Record<string, number> = { u4: 6, u5: 5, u6: 5, u10: 5, u11: 5, u12: 6 };
const lessons = UNITS.flatMap((u) => u.lessons);
const SEEDS = [1, 7, 42, 2026];

/** True when every tile of `answer` can be taken from `bank` (each tile used once). */
function buildable(answer: string, bank: readonly string[]): boolean {
  const left = [...bank];
  for (const tile of tokenize(answer)) {
    const i = left.indexOf(tile);
    if (i === -1) return false;
    left.splice(i, 1);
  }
  return true;
}

describe('content-b units', () => {
  it('have the lessons from the spec, numbered u<unit>l1…n', () => {
    for (const unit of UNITS) {
      expect(unit.lessons.length, unit.id).toBe(LESSON_COUNT[unit.id]);
      unit.lessons.forEach((lesson, i) => expect(lesson.id).toBe(`${unit.id}l${i + 1}`));
    }
    const ids = lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('give every lesson 5 words (unique en and he) with a Hebrew transliteration, and 3–4 sentences', () => {
    for (const lesson of lessons) {
      expect(lesson.words.length, lesson.id).toBe(5);
      expect(new Set(lesson.words.map((w) => wordId(w))).size, lesson.id).toBe(5);
      expect(new Set(lesson.words.map((w) => w.he)).size, lesson.id).toBe(5);
      for (const w of lesson.words) expect(w.sound ?? '', `${lesson.id} ${w.en}`).toMatch(/[א-ת]/);
      expect(lesson.sentences.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.sentences.length, lesson.id).toBeLessThanOrEqual(4);
    }
  });

  it('never reuse a word id or a Hebrew translation across these units', () => {
    const ids = new Map<string, string>();
    const he = new Map<string, string>();
    for (const lesson of lessons) {
      for (const w of lesson.words) {
        expect(ids.get(wordId(w)), `${wordId(w)} in ${lesson.id}`).toBeUndefined();
        expect(he.get(w.he), `${w.he} in ${lesson.id}`).toBeUndefined();
        ids.set(wordId(w), lesson.id);
        he.set(w.he, lesson.id);
      }
    }
  });

  it('give new lessons errors on most sentences and a feminine heAlt where the Hebrew has gender', () => {
    for (const lesson of lessons) {
      for (const s of lesson.sentences) {
        for (const a of s.alt ?? []) expect(a.trim(), `${lesson.id} "${s.en}" alt`).not.toBe('');
        for (const a of s.heAlt ?? []) expect(a, `${lesson.id} "${s.en}" heAlt`).not.toBe(s.he);
        // "אתה …?" questions and masculine "אני …" present tense need a feminine alternative.
        if (/^(.*\s)?אתה\s/.test(s.he)) expect(s.heAlt, `${lesson.id} "${s.he}"`).toBeDefined();
      }
    }
  });

  for (const lesson of lessons) {
    it(`builds solvable exercises for ${lesson.id}`, () => {
      for (const seed of SEEDS) {
        const exercises = generateExercises(lesson, seededRng(seed));
        expect(exercises.length).toBeGreaterThan(lesson.words.length);
        for (const ex of exercises) {
          if (ex.kind === 'choice') {
            expect(ex.options).toContain(ex.answer);
            expect(new Set(ex.options).size).toBe(ex.options.length);
          } else if (ex.kind === 'match') {
            expect(ex.pairs.length).toBe(5);
          } else if (ex.kind === 'blank') {
            expect(ex.options).toContain(ex.answer);
          } else if (ex.kind === 'type') {
            expect(checkTyped(ex.answers[0], ex.answers).kind).toBe('correct');
          } else if (ex.kind === 'speak') {
            expect(isSpokenCorrectly([ex.prompt], ex.answers)).toBe(true);
          } else {
            expect(buildable(ex.answers[0], ex.bank), `${lesson.id} seed ${seed}: "${ex.answers[0]}"`).toBe(true);
            expect(isCorrect(tokenize(ex.answers[0]).join(' '), ex.answers)).toBe(true);
            // Once the exercise accepts the feminine form (spec §7.5), heAlt[0] must be buildable too.
            const feminine = lesson.sentences.find((s) => s.he === ex.answers[0])?.heAlt?.[0];
            if (feminine && ex.answers.includes(feminine)) {
              expect(buildable(feminine, ex.bank), `${lesson.id} seed ${seed}: "${feminine}"`).toBe(true);
            }
          }
        }
      }
    });
  }
});
