import { describe, expect, it, vi } from 'vitest';
import { isItemKey, sentenceKey, wordKey } from '../../shared/item-keys';
import type { ItemState } from '../../shared/srs';
import { REVIEW_LENGTH } from '../../shared/srs';
import { allLessons } from '../data/course';
import type { Exercise } from '../types';
import { tokenize } from './answer';
import { completeLesson, dateKey, initialProgress, shiftDateKey } from './progress';
import { seededRng } from './random';
import { buildReview, generateReview, isReviewable, reviewExercise } from './review';
import { emptySrs, type SrsStore } from './srs';

/*
 * dueKeys/upcomingKeys belong to the backend agent (src/lib/srs.ts). The review generator only
 * relies on their contract (docs/spec/v2.md §6.3), so this test uses a local implementation of
 * that contract and keeps working whatever state the engine is in.
 */
vi.mock('./srs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./srs')>();
  const today = (now: number) => {
    const d = new Date(now);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return {
    ...actual,
    dueKeys: (store: SrsStore, now = Date.now()) =>
      Object.entries(store.items)
        .filter(([, s]) => s.due <= today(now))
        .sort(
          ([ka, a], [kb, b]) =>
            a.box - b.box ||
            b.wrong / Math.max(b.seen, 1) - a.wrong / Math.max(a.seen, 1) ||
            a.due.localeCompare(b.due) ||
            ka.localeCompare(kb),
        )
        .map(([k]) => k),
    upcomingKeys: (store: SrsStore, limit: number, now = Date.now()) =>
      Object.entries(store.items)
        .filter(([, s]) => s.due > today(now))
        .sort(([, a], [, b]) => a.due.localeCompare(b.due) || a.box - b.box)
        .slice(0, limit)
        .map(([k]) => k),
  };
});

const NOW = new Date(2026, 9, 18, 12).getTime();
const TODAY = dateKey(NOW);

function state(box: ItemState['box'], dueInDays = 0, wrong = 0): ItemState {
  return { box, due: shiftDateKey(TODAY, dueInDays), seen: 2, wrong, last: NOW - 1000 };
}

function store(items: Record<string, ItemState>): SrsStore {
  return { ...emptySrs(), seeded: true, items };
}

/** Every word and sentence key of the first lessons, in course order. */
const allKeys = allLessons
  .slice(0, 4)
  .flatMap((l) => [...l.words.map((w) => wordKey(w)), ...l.sentences.map((_, i) => sentenceKey(l.id, i))]);

const keysOf = (ex: Exercise) => (ex.kind === 'match' ? (ex.itemKeys ?? []) : [ex.itemKey]);

function expectSolvable(ex: Exercise) {
  if (ex.kind === 'build') {
    const bank = [...ex.bank];
    for (const tile of tokenize(ex.answers[0])) {
      const i = bank.indexOf(tile);
      expect(i, `missing tile "${tile}"`).toBeGreaterThanOrEqual(0);
      bank.splice(i, 1);
    }
  }
  if (ex.kind === 'choice') expect(ex.options).toContain(ex.answer);
}

const done = completeLesson(completeLesson(initialProgress(NOW), 'u1l1', 10, NOW), 'u1l2', 10, NOW);

describe('generateReview (US-R2)', () => {
  it('AC1: 12 due items → 10 exercises, lowest box first', () => {
    const keys = allKeys.slice(0, 12);
    const items = Object.fromEntries(keys.map((k, i) => [k, state((i % 3) as ItemState['box'], -1)]));
    const session = buildReview(store(items), done, seededRng(1), NOW);
    expect(session.exercises).toHaveLength(REVIEW_LENGTH);
    expect(session.source).toBe('due');
    expect(session.due).toBe(REVIEW_LENGTH);
    const boxes = session.exercises.map((ex) => items[keysOf(ex)[0]!].box);
    expect(boxes).toEqual([...boxes].sort((a, b) => a - b));
    // The two items left out are from the highest box.
    const left = keys.filter((k) => !session.exercises.some((ex) => keysOf(ex).includes(k)));
    for (const k of left) expect(items[k].box).toBe(2);
  });

  it('AC2: 3 due + 5 upcoming → all 3 due first, then the upcoming ones', () => {
    const due = allKeys.slice(0, 3);
    const upcoming = allKeys.slice(3, 8);
    const items = {
      ...Object.fromEntries(due.map((k) => [k, state(1, 0)])),
      ...Object.fromEntries(upcoming.map((k, i) => [k, state(2, i + 1)])),
    };
    const session = buildReview(store(items), done, seededRng(2), NOW);
    const keys = session.exercises.flatMap(keysOf);
    expect(keys.slice(0, 3).sort()).toEqual([...due].sort());
    expect(keys.slice(3)).toEqual(upcoming);
    expect(session.source).toBe('mixed');
    expect(session.due).toBe(3);
  });

  it('AC3: every exercise has a valid item key and every build is solvable', () => {
    const items = Object.fromEntries(allKeys.map((k) => [k, state(0, 0)]));
    for (let seed = 1; seed <= 20; seed++) {
      for (const ex of generateReview(store(items), done, seededRng(seed), NOW)) {
        for (const key of keysOf(ex)) expect(isItemKey(key)).toBe(true);
        expect(ex.kind).not.toBe('match');
        expectSolvable(ex);
      }
    }
  });

  it('AC4: completed lessons but no SRS items → a practice session', () => {
    const session = buildReview(emptySrs(), done, seededRng(4), NOW);
    expect(session.source).toBe('practice');
    expect(session.exercises.length).toBeGreaterThan(0);
    expect(session.exercises.filter((e) => e.kind === 'match').length).toBeLessThanOrEqual(1);
  });

  it('tops up a tiny session with practice exercises for other items', () => {
    const key = wordKey(allLessons[0].words[0]);
    const session = buildReview(store({ [key]: state(0, 0) }), done, seededRng(5), NOW);
    expect(session.source).toBe('mixed');
    expect(keysOf(session.exercises[0])).toEqual([key]);
    expect(session.exercises.length).toBeGreaterThan(1);
    expect(session.exercises.length).toBeLessThanOrEqual(REVIEW_LENGTH);
    const others = session.exercises.slice(1).flatMap(keysOf);
    expect(others).not.toContain(key);
  });

  it('skips keys that are no longer in the course', () => {
    const items = {
      'w:no-such-word': state(0, 0),
      's:u1l1:3': state(0, 0),
      's:u99l1:0': state(0, 0),
      ...Object.fromEntries(allKeys.slice(0, 5).map((k) => [k, state(1, 0)])),
    };
    const session = buildReview(store(items), done, seededRng(6), NOW);
    expect(session.exercises.flatMap(keysOf)).toEqual(expect.arrayContaining(allKeys.slice(0, 5)));
    expect(session.exercises.flatMap(keysOf)).not.toContain('w:no-such-word');
    expect(session.due).toBe(5);
    expect(isReviewable('s:u1l1:3')).toBe(allLessons[0].sentences.length > 3);
  });

  it('nothing completed and nothing stored → empty session', () => {
    expect(generateReview(emptySrs(), initialProgress(NOW), seededRng(7), NOW)).toEqual([]);
  });
});

describe('reviewExercise', () => {
  it('words become a choice in either direction with distractors from the course so far', () => {
    const word = allLessons[1].words[0];
    const directions = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const ex = reviewExercise(wordKey(word), seededRng(seed))!;
      expect(ex.kind).toBe('choice');
      if (ex.kind !== 'choice') continue;
      directions.add(ex.promptLang);
      expect(ex.options).toHaveLength(4);
      expect(ex.itemKey).toBe(wordKey(word));
    }
    expect(directions.size).toBe(2);
  });

  it('sentences become build-en, listen or build-he', () => {
    const key = sentenceKey('u1l2', 0);
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const ex = reviewExercise(key, seededRng(seed))!;
      if (ex.kind !== 'build') throw new Error('expected build');
      kinds.add(ex.listen ? 'listen' : `build-${ex.answerLang}`);
      expect(ex.itemKey).toBe(key);
    }
    expect([...kinds].sort()).toEqual(['build-en', 'build-he', 'listen']);
  });
});

describe('typing in reviews (US-K2)', () => {
  const lesson = allLessons[0];
  const key = sentenceKey(lesson.id, 0);

  it('types sentences the learner knows well and builds the others', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(reviewExercise(key, seededRng(seed), 3)?.kind).toBe('type');
      expect(reviewExercise(key, seededRng(seed), 2)?.kind).toBe('build');
    }
  });

  it('keeps words as multiple choice whatever the box', () => {
    expect(reviewExercise(wordKey(lesson.words[0]), seededRng(1), 5)?.kind).toBe('choice');
  });

  it('uses each item box from the store', () => {
    const today = dateKey(Date.now());
    const state: ItemState = { box: 4, due: today, seen: 3, wrong: 0, last: 1 };
    const srs: SrsStore = { ...emptySrs(), items: { [key]: state } };
    const session = buildReview(srs, completeLesson(initialProgress(), lesson.id, 10), seededRng(3));
    expect(session.exercises.find((e) => e.kind === 'type' || e.kind === 'build')?.kind).toBe('type');
  });
});
