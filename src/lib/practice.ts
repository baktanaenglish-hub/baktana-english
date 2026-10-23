import { allLessons } from '../data/course';
import type { Exercise } from '../types';
import { generateExercises } from './exercises';
import { completeLesson, type Progress } from './progress';
import { shuffle, type Rng } from './random';

export const PRACTICE_LENGTH = 10;
export const PRACTICE_XP = 10;

export function canPractice(p: Progress): boolean {
  return allLessons.some((l) => (p.completed[l.id] ?? 0) > 0);
}

/**
 * A review session mixing exercises from up to three random completed lessons.
 * At most one matching round, so the session stays varied.
 */
export function generatePractice(p: Progress, rng: Rng = Math.random, length = PRACTICE_LENGTH): Exercise[] {
  const done = allLessons.filter((l) => (p.completed[l.id] ?? 0) > 0);
  const picked = shuffle(done, rng).slice(0, 3);
  const pool = shuffle(
    picked.flatMap((lesson) => generateExercises(lesson, rng)),
    rng,
  );
  const out: Exercise[] = [];
  let hasMatch = false;
  for (const exercise of pool) {
    if (out.length >= length) break;
    if (exercise.kind === 'match') {
      if (hasMatch) continue;
      hasMatch = true;
    }
    out.push(exercise);
  }
  return out;
}

/** Awards practice XP (counts for streak and daily goal) without marking a lesson complete. */
export function completePractice(p: Progress, xp: number, now = Date.now()): Progress {
  const next = completeLesson(p, '__practice__', xp, now);
  return { ...next, completed: p.completed };
}
