import { course } from '../data/course';
import type { Exercise, Unit } from '../types';
import { buildSentence, typeSentence, vocabularyUpTo, wordChoice } from './exercises';
import type { Progress } from './progress';
import { shuffle, type Rng } from './random';

/**
 * Placement test: three questions per unit, in course order. A unit counts as known with two
 * right answers out of three; the test stops at the first unit that isn't, and every lesson of
 * the units before it is marked completed (no XP – the league is for practice).
 */

export const QUESTIONS_PER_UNIT = 3;
export const PASS_PER_UNIT = 2;

/** One unit's questions: a word in each direction and a sentence (typed from unit 2 on). */
export function unitQuestions(unit: Unit, unitIndex: number, rng: Rng): Exercise[] {
  const lessons = shuffle(unit.lessons, rng);
  const a = lessons[0];
  const b = lessons[1 % lessons.length];
  const c = lessons[2 % lessons.length];
  const wordA = a.words[Math.floor(rng() * a.words.length)];
  const wordB = b.words[Math.floor(rng() * b.words.length)];
  const index = Math.floor(rng() * c.sentences.length);
  const sentence = unitIndex >= 1 ? typeSentence(c, index) : buildSentence(c, index, 'en', rng);
  return [wordChoice(wordA, vocabularyUpTo(a), true, rng), sentence, wordChoice(wordB, vocabularyUpTo(b), false, rng)];
}

/** All the questions, unit after unit (the test usually stops long before the end). */
export function placementQuestions(rng: Rng = Math.random): Exercise[] {
  return course.flatMap((unit, i) => unitQuestions(unit, i, rng));
}

/** Units passed so far, counting only complete groups of three. */
export function unitsPassed(answers: readonly boolean[]): number {
  let passed = 0;
  for (let start = 0; start + QUESTIONS_PER_UNIT <= answers.length; start += QUESTIONS_PER_UNIT) {
    const right = answers.slice(start, start + QUESTIONS_PER_UNIT).filter(Boolean).length;
    if (right < PASS_PER_UNIT) break;
    passed += 1;
  }
  return passed;
}

/** Stop as soon as a unit is finished without enough right answers. */
export function placementDone(answers: readonly boolean[]): boolean {
  return answers.length % QUESTIONS_PER_UNIT === 0 && unitsPassed(answers) < answers.length / QUESTIONS_PER_UNIT;
}

/** Marks every lesson of the first `units` units as completed (keeping higher counts). */
export function applyPlacement(progress: Progress, units: number): Progress {
  const completed = { ...progress.completed };
  for (const unit of course.slice(0, units)) {
    for (const lesson of unit.lessons) completed[lesson.id] = Math.max(completed[lesson.id] ?? 0, 1);
  }
  return { ...progress, completed };
}
