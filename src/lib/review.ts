/**
 * Review sessions built from due spaced-repetition items. Spec: docs/spec/v2.md §7.2.
 * Owned by the UI agent.
 */
import { parseItemKey, wordId } from '../../shared/item-keys';
import { REVIEW_LENGTH } from '../../shared/srs';
import { allLessons } from '../data/course';
import type { Exercise, Lesson, Word } from '../types';
import { buildSentence, typeSentence, vocabularyUpTo, wordChoice } from './exercises';
import { generatePractice } from './practice';
import type { Progress } from './progress';
import type { Rng } from './random';
import { dueKeys, upcomingKeys, type SrsStore } from './srs';

/** Below this many spaced-repetition items the session is topped up with random practice. */
export const MIN_REVIEW_ITEMS = 4;
/** Probabilities of the sentence exercise kinds (the rest is build-en). */
export const LISTEN_SHARE = 0.25;
export const BUILD_HE_SHARE = 0.2;
/** Sentences the learner already knows well (this box or higher) are typed instead of built. */
export const TYPE_FROM_BOX = 3;

/** Where the exercises of a session came from – reported with `review_start`. */
export type ReviewSource = 'due' | 'mixed' | 'practice';

export interface ReviewSession {
  exercises: Exercise[];
  source: ReviewSource;
  /** Number of due items included. */
  due: number;
}

interface WordRef {
  word: Word;
  lesson: Lesson;
}

let wordIndex: Map<string, WordRef> | null = null;

/** wordId → the first lesson that teaches it (distractors come from the course up to there). */
function findWord(id: string): WordRef | undefined {
  if (!wordIndex) {
    wordIndex = new Map();
    for (const lesson of allLessons) {
      for (const word of lesson.words) {
        const key = wordId(word);
        if (!wordIndex.has(key)) wordIndex.set(key, { word, lesson });
      }
    }
  }
  return wordIndex.get(id);
}

/** True when the key points at a word or sentence that exists in the course. */
export function isReviewable(key: string): boolean {
  const parsed = parseItemKey(key);
  if (!parsed) return false;
  if (parsed.kind === 'word') return findWord(parsed.id) !== undefined;
  const lesson = allLessons.find((l) => l.id === parsed.id);
  return lesson !== undefined && parsed.index! < lesson.sentences.length;
}

/**
 * One exercise for one item key; undefined when the key is not in the course. Sentences in a
 * high box (`box` ≥ TYPE_FROM_BOX) are typed – free recall is the harder, stronger review.
 */
export function reviewExercise(key: string, rng: Rng, box = 0): Exercise | undefined {
  const parsed = parseItemKey(key);
  if (!parsed) return undefined;
  if (parsed.kind === 'word') {
    const ref = findWord(parsed.id);
    if (!ref) return undefined;
    return wordChoice(ref.word, vocabularyUpTo(ref.lesson), rng() < 0.5, rng);
  }
  const lesson = allLessons.find((l) => l.id === parsed.id);
  const index = parsed.index!;
  if (!lesson || index >= lesson.sentences.length) return undefined;
  const r = rng();
  if (box >= TYPE_FROM_BOX) return typeSentence(lesson, index, r < LISTEN_SHARE);
  if (r < LISTEN_SHARE) return buildSentence(lesson, index, 'en', rng, true);
  if (r < LISTEN_SHARE + BUILD_HE_SHARE) return buildSentence(lesson, index, 'he', rng);
  return buildSentence(lesson, index, 'en', rng);
}

function keysOf(exercise: Exercise): string[] {
  if (exercise.kind === 'match') return exercise.itemKeys ?? [];
  return exercise.itemKey ? [exercise.itemKey] : [];
}

/**
 * Picks the items of a review session: due items weakest first (up to REVIEW_LENGTH), then the
 * closest upcoming ones, then – if fewer than MIN_REVIEW_ITEMS – random practice exercises from
 * completed lessons. Keys missing from the course are skipped. Each item key gets one
 * exercise (no matching round: match answers never move an item to a higher box).
 */
export function buildReview(
  srs: SrsStore,
  progress: Progress,
  rng: Rng = Math.random,
  now = Date.now(),
): ReviewSession {
  const due = dueKeys(srs, now).filter(isReviewable).slice(0, REVIEW_LENGTH);
  const keys = [...due];
  if (keys.length < REVIEW_LENGTH) {
    // Ask for a few extra in case some are no longer in the course.
    const upcoming = upcomingKeys(srs, REVIEW_LENGTH * 2, now).filter((k) => isReviewable(k) && !keys.includes(k));
    keys.push(...upcoming.slice(0, REVIEW_LENGTH - keys.length));
  }
  const exercises = keys
    .map((key) => reviewExercise(key, rng, srs.items[key]?.box))
    .filter((e): e is Exercise => e !== undefined);
  let source: ReviewSource = keys.length > due.length ? 'mixed' : 'due';

  if (exercises.length < MIN_REVIEW_ITEMS) {
    const used = new Set(keys);
    let hasMatch = false;
    for (const extra of generatePractice(progress, rng, REVIEW_LENGTH * 2)) {
      if (exercises.length >= REVIEW_LENGTH) break;
      // Reviews revisit scheduled items; speaking has none.
      if (extra.kind === 'speak') continue;
      const extraKeys = keysOf(extra);
      if (extraKeys.some((k) => used.has(k))) continue;
      if (extra.kind === 'match') {
        if (hasMatch) continue;
        hasMatch = true;
      }
      extraKeys.forEach((k) => used.add(k));
      exercises.push(extra);
    }
    source = keys.length === 0 ? 'practice' : 'mixed';
  }
  return { exercises, source, due: due.length };
}

/**
 * Up to REVIEW_LENGTH exercises: due items weakest first, then upcoming items, then random
 * exercises from completed lessons. Every exercise carries its item key(s).
 */
export function generateReview(
  srs: SrsStore,
  progress: Progress,
  rng: Rng = Math.random,
  now = Date.now(),
): Exercise[] {
  return buildReview(srs, progress, rng, now).exercises;
}
