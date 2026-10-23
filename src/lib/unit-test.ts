import type { Exercise, Unit } from '../types';
import { buildSentence, typeSentence, vocabularyUpTo, wordChoice } from './exercises';
import { TYPED_LISTENING_FROM_UNIT, TYPING_FROM_UNIT } from './exercises';
import { completeLesson, type Progress } from './progress';
import { shuffle, type Rng } from './random';

/**
 * End-of-unit test: ten questions over the whole unit, opened once every lesson of it is done.
 * Eight right answers pass it: the unit gets a crown 👑 and 20 XP. It is stored in `completed`
 * under the checkpoint id `<unit>cp` (e.g. "u1cp"), which the progress sanitizers already keep,
 * so it syncs like a lesson.
 */

export const UNIT_TEST_QUESTIONS = 10;
export const UNIT_TEST_PASS = 8;
export const UNIT_TEST_XP = 20;

export const unitTestId = (unit: Unit) => `${unit.id}cp`;

export function unitTestOpen(progress: Progress, unit: Unit): boolean {
  return unit.lessons.length > 0 && unit.lessons.every((l) => (progress.completed[l.id] ?? 0) > 0);
}

export function unitTestPassed(progress: Progress, unit: Unit): boolean {
  return (progress.completed[unitTestId(unit)] ?? 0) > 0;
}

/**
 * Four words (both directions) and six sentences from across the unit: built from tiles in
 * unit 1, typed from unit 2, one into Hebrew and one listening – mixed in random order.
 */
export function unitTestQuestions(unit: Unit, unitIndex: number, rng: Rng = Math.random): Exercise[] {
  const words = shuffle(
    unit.lessons.flatMap((lesson) => lesson.words.map((word) => ({ word, lesson }))),
    rng,
  ).slice(0, 4);
  const sentences = shuffle(
    unit.lessons.flatMap((lesson) => lesson.sentences.map((_, index) => ({ lesson, index }))),
    rng,
  ).slice(0, 6);
  const typing = unitIndex >= TYPING_FROM_UNIT;
  const questions: Exercise[] = [
    ...words.map(({ word, lesson }, i) => wordChoice(word, vocabularyUpTo(lesson), i % 2 === 0, rng)),
    ...sentences.map(({ lesson, index }, i) => {
      if (i === 0) return buildSentence(lesson, index, 'he', rng);
      if (i === 1) {
        return unitIndex >= TYPED_LISTENING_FROM_UNIT
          ? typeSentence(lesson, index, true)
          : buildSentence(lesson, index, 'en', rng, true);
      }
      return typing && i <= 3 ? typeSentence(lesson, index) : buildSentence(lesson, index, 'en', rng);
    }),
  ];
  return shuffle(questions, rng);
}

export function unitTestScore(answers: readonly boolean[]): { right: number; passed: boolean } {
  const right = answers.filter(Boolean).length;
  return { right, passed: right >= UNIT_TEST_PASS };
}

/** Records a passed test like a finished lesson: XP, streak and daily goal count it. */
export function applyUnitTest(progress: Progress, unit: Unit, now = Date.now()): Progress {
  return completeLesson(progress, unitTestId(unit), UNIT_TEST_XP, now);
}
