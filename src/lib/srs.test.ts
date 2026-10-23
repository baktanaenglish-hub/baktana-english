import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentenceKey, wordKey } from '../../shared/item-keys';
import type { ItemState } from '../../shared/srs';
import { allLessons } from '../data/course';
import type { ExerciseType, ItemAnswer } from '../types';
import { dateKey, initialProgress, shiftDateKey } from './progress';
import { seededRng } from './random';
import {
  SRS_STORAGE_KEY,
  afterPull,
  afterPush,
  applyAnswers,
  dirtyDelta,
  dueCount,
  dueKeys,
  emptySrs,
  loadSrs,
  saveSrs,
  seedFromProgress,
  upcomingKeys,
  type SrsStore,
} from './srs';

const NOW = new Date(2026, 2, 10, 12).getTime();
const TODAY = dateKey(NOW);
const day = (n: number) => shiftDateKey(TODAY, n);

const ans = (itemKey: string, correct: boolean, exType: ExerciseType = 'build-en'): ItemAnswer => ({
  itemKey,
  correct,
  exType,
});
const state = (over: Partial<ItemState> = {}): ItemState => ({
  box: 2,
  due: TODAY,
  seen: 3,
  wrong: 1,
  last: 1000,
  ...over,
});
const storeWith = (items: Record<string, ItemState>, over: Partial<SrsStore> = {}): SrsStore => ({
  ...emptySrs(),
  seeded: true,
  items,
  ...over,
});

describe('applyAnswers (US-R3)', () => {
  it('AC1: a new item answered right goes to box 1, due tomorrow', () => {
    const s = applyAnswers(emptySrs(), [ans('w:cat', true, 'choice-en')], 'lesson', NOW);
    expect(s.items['w:cat']).toEqual({ box: 1, due: day(1), seen: 1, wrong: 0, last: NOW });
    expect(s.dirty).toEqual(['w:cat']);
  });

  it('AC2: a new item answered wrong goes to box 0, due today, wrong 1', () => {
    const s = applyAnswers(emptySrs(), [ans('w:cat', false)], 'lesson', NOW);
    expect(s.items['w:cat']).toEqual({ box: 0, due: TODAY, seen: 1, wrong: 1, last: NOW });
  });

  it('a new item seen only in a match stays in box 0 even when right', () => {
    const s = applyAnswers(emptySrs(), [ans('w:cat', true, 'match')], 'lesson', NOW);
    expect(s.items['w:cat']).toEqual({ box: 0, due: TODAY, seen: 1, wrong: 0, last: NOW });
  });

  it('AC3: box 2 due today, answered right → box 3, due in 7 days', () => {
    const s = applyAnswers(storeWith({ k: state() }), [ans('k', true)], 'review', NOW);
    expect(s.items.k).toEqual({ box: 3, due: day(7), seen: 4, wrong: 1, last: NOW });
  });

  it('an overdue item moves up from today', () => {
    const s = applyAnswers(storeWith({ k: state({ box: 1, due: day(-5) }) }), [ans('k', true)], 'review', NOW);
    expect(s.items.k).toMatchObject({ box: 2, due: day(3) });
  });

  it('AC4: box 4 answered wrong → box 1, due today, wrong + 1', () => {
    const s = applyAnswers(storeWith({ k: state({ box: 4, due: day(5) }) }), [ans('k', false)], 'review', NOW);
    expect(s.items.k).toEqual({ box: 1, due: TODAY, seen: 4, wrong: 2, last: NOW });
  });

  it('box 0 answered wrong stays in box 0', () => {
    const s = applyAnswers(storeWith({ k: state({ box: 0 }) }), [ans('k', false)], 'review', NOW);
    expect(s.items.k.box).toBe(0);
  });

  it('AC5: box 2 not due yet, answered right → box and due unchanged, seen + 1', () => {
    const s = applyAnswers(storeWith({ k: state({ due: day(2) }) }), [ans('k', true)], 'lesson', NOW);
    expect(s.items.k).toEqual({ box: 2, due: day(2), seen: 4, wrong: 1, last: NOW });
  });

  it('AC6: a mistake in a match only → wrong + 1, box unchanged', () => {
    const s = applyAnswers(storeWith({ k: state({ box: 3, due: day(4) }) }), [ans('k', false, 'match')], 'lesson', NOW);
    expect(s.items.k).toEqual({ box: 3, due: day(4), seen: 4, wrong: 2, last: NOW });
  });

  it('a right match answer does not move a due item', () => {
    const s = applyAnswers(storeWith({ k: state() }), [ans('k', true, 'match')], 'review', NOW);
    expect(s.items.k).toMatchObject({ box: 2, due: TODAY, seen: 4 });
  });

  it('AC7: two answers to one key in a session → a single update (wrong if any was wrong)', () => {
    const s = applyAnswers(storeWith({ k: state() }), [ans('k', true), ans('k', false, 'match')], 'lesson', NOW);
    expect(s.items.k).toEqual({ box: 1, due: TODAY, seen: 4, wrong: 2, last: NOW });
    const right = applyAnswers(storeWith({ k: state() }), [ans('k', true, 'match'), ans('k', true)], 'lesson', NOW);
    expect(right.items.k).toMatchObject({ box: 3, seen: 4 });
  });

  it('AC8: box 5 answered right stays 5, due in 35 days', () => {
    const s = applyAnswers(storeWith({ k: state({ box: 5 }) }), [ans('k', true)], 'review', NOW);
    expect(s.items.k).toMatchObject({ box: 5, due: day(35) });
  });

  it('marks updated keys dirty once and leaves other items alone', () => {
    const start = storeWith({ a: state(), b: state() }, { dirty: ['a'] });
    const s = applyAnswers(start, [ans('a', true), ans('c', true)], 'lesson', NOW);
    expect(s.dirty).toEqual(['a', 'c']);
    expect(s.items.b).toBe(start.items.b);
    expect(start.items.a.box).toBe(2); // not mutated
    expect(applyAnswers(start, [], 'lesson', NOW)).toBe(start);
  });
});

describe('dueKeys / upcomingKeys', () => {
  const store = storeWith({
    'w:b3': state({ box: 3, due: day(-1) }),
    'w:b1-few-wrong': state({ box: 1, seen: 4, wrong: 1 }),
    'w:b1-many-wrong': state({ box: 1, seen: 2, wrong: 2 }),
    'w:b1-old': state({ box: 1, seen: 4, wrong: 1, due: day(-3) }),
    'w:b1-tie-a': state({ box: 1, seen: 4, wrong: 1, due: day(-3) }),
    'w:later-b2': state({ box: 2, due: day(2) }),
    'w:later-b1': state({ box: 1, due: day(2) }),
    'w:soon': state({ box: 4, due: day(1) }),
  });

  it('lists due items weakest first: box, error rate, due date, key', () => {
    expect(dueKeys(store, NOW)).toEqual(['w:b1-many-wrong', 'w:b1-old', 'w:b1-tie-a', 'w:b1-few-wrong', 'w:b3']);
    expect(dueCount(store, NOW)).toBe(5);
    expect(dueKeys(emptySrs(), NOW)).toEqual([]);
  });

  it('lists upcoming items by due date, then box', () => {
    expect(upcomingKeys(store, 10, NOW)).toEqual(['w:soon', 'w:later-b1', 'w:later-b2']);
    expect(upcomingKeys(store, 2, NOW)).toEqual(['w:soon', 'w:later-b1']);
  });
});

describe('seedFromProgress (US-R5 AC3)', () => {
  const doneIds = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2'];
  const progress = { ...initialProgress(NOW), completed: Object.fromEntries(doneIds.map((id) => [id, 1])) };
  const lessons = allLessons.filter((l) => doneIds.includes(l.id));
  const wordKeys = new Set(lessons.flatMap((l) => l.words.map(wordKey)));
  const sentenceKeys = lessons.flatMap((l) => l.sentences.map((_, i) => sentenceKey(l.id, i)));

  it('creates box-1 items for every word and sentence of completed lessons', () => {
    const s = seedFromProgress(emptySrs(), progress, NOW, seededRng(1));
    const keys = Object.keys(s.items);
    expect(keys.filter((k) => k.startsWith('w:'))).toHaveLength(wordKeys.size);
    expect(keys.filter((k) => k.startsWith('s:'))).toHaveLength(sentenceKeys.length);
    // The spec's numbers for this course: 25 words and 16 sentences.
    expect([wordKeys.size, sentenceKeys.length]).toEqual([25, 16]);
    for (const item of Object.values(s.items)) {
      expect(item).toMatchObject({ box: 1, seen: 1, wrong: 0, last: 0 });
      expect(item.due >= TODAY && item.due <= day(6)).toBe(true);
    }
    expect(new Set(Object.values(s.items).map((i) => i.due)).size).toBeGreaterThan(1);
    expect(s.seeded).toBe(true);
    expect(s.dirty).toEqual([]);
  });

  it('runs only once and keeps existing items', () => {
    const existing = storeWith({ 'w:i': state({ box: 4 }) }, { seeded: false });
    const s = seedFromProgress(existing, progress, NOW, seededRng(2));
    expect(s.items['w:i'].box).toBe(4);
    const again = seedFromProgress(s, { ...progress, completed: { ...progress.completed, u2l3: 1 } }, NOW);
    expect(again).toBe(s);
  });

  it('leaves a learner with nothing completed unseeded, so progress that arrives later is seeded', () => {
    const empty = emptySrs();
    expect(seedFromProgress(empty, initialProgress(NOW), NOW)).toBe(empty);
    // Regression: signing in on a fresh install pulls the old progress after start-up; it used to
    // find the store already marked as seeded and never created the review items.
    const s = seedFromProgress(empty, progress, NOW, seededRng(3));
    expect(Object.keys(s.items)).toHaveLength(wordKeys.size + sentenceKeys.length);
    expect(s.seeded).toBe(true);
  });

  it('only marks a store that already holds real answers as seeded (a learner of this release)', () => {
    const answered = applyAnswers(emptySrs(), [ans(sentenceKey('u1l1', 0), true)], 'lesson', NOW);
    const s = seedFromProgress(answered, { ...initialProgress(NOW), completed: { u1l1: 1 } }, NOW);
    expect(s.seeded).toBe(true);
    expect(s.items).toEqual(answered.items);
  });

  it('ignores unknown lesson ids', () => {
    const s = seedFromProgress(emptySrs(), { ...initialProgress(NOW), completed: { u13l1: 1 } }, NOW);
    expect(s.items).toEqual({});
  });
});

describe('storage (US-R5 AC1/AC2)', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      data,
    };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('round-trips the store', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const s = applyAnswers(emptySrs(), [ans('w:cat', true)], 'lesson', NOW);
    saveSrs(s);
    expect(storage.data.has(SRS_STORAGE_KEY)).toBe(true);
    expect(loadSrs(NOW)).toEqual(s);
  });

  it('yields an empty store when storage is missing, corrupt or blocked', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadSrs(NOW)).toEqual(emptySrs());
    vi.stubGlobal('localStorage', memoryStorage({ [SRS_STORAGE_KEY]: '{not json' }));
    expect(loadSrs(NOW)).toEqual(emptySrs());
    vi.stubGlobal('localStorage', memoryStorage({ [SRS_STORAGE_KEY]: JSON.stringify({ v: 2, items: {} }) }));
    expect(loadSrs(NOW)).toEqual(emptySrs());
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(loadSrs(NOW)).toEqual(emptySrs());
    expect(() => saveSrs(emptySrs())).not.toThrow();
  });

  it('drops invalid items and stray dirty keys from a damaged store', () => {
    const raw = {
      v: 1,
      seeded: true,
      items: { 'w:ok': state(), 'w:bad': { box: 9, due: TODAY, seen: 1, wrong: 0, last: 1 }, nope: state() },
      dirty: ['w:ok', 'w:bad', 'w:ok', 7],
    };
    vi.stubGlobal('localStorage', memoryStorage({ [SRS_STORAGE_KEY]: JSON.stringify(raw) }));
    expect(loadSrs(NOW)).toEqual({ v: 1, seeded: true, items: { 'w:ok': state() }, dirty: ['w:ok'] });
  });
});

describe('sync helpers (US-R6)', () => {
  it('uploads only dirty items', () => {
    const s = storeWith({ a: state(), b: state() }, { dirty: ['a', 'gone'] });
    expect(dirtyDelta(s)).toEqual({ a: state() });
  });

  it('afterPush merges the server state and clears sent keys unless they changed meanwhile', () => {
    const sent = { a: state({ last: 100 }), b: state({ last: 100 }) };
    // While the request was out, "b" was answered again.
    const local = storeWith({ a: sent.a, b: state({ last: 300, box: 1 }) }, { dirty: ['a', 'b'] });
    const server = { a: state({ last: 100 }), b: state({ last: 100 }), c: state({ last: 50, box: 4 }) };
    const s = afterPush(local, sent, server);
    expect(s.dirty).toEqual(['b']);
    expect(s.items.b).toMatchObject({ box: 1, last: 300 });
    expect(s.items.c).toEqual(server.c);
  });

  it('AC1: two devices converge on the newer state', () => {
    const a = storeWith({ k: state({ box: 1, last: 200 }) });
    const b = storeWith({ k: state({ box: 3, last: 100 }) });
    const server = afterPull(b, a.items).items;
    expect(server.k.box).toBe(1);
    expect(afterPull(a, server).items.k.box).toBe(1);
  });

  it('AC5: after sign-in every local item the server lacks or differs on becomes dirty', () => {
    const local = storeWith({ seeded: state({ last: 0 }), same: state(), newer: state({ last: 5000 }) });
    const server = { same: state(), newer: state({ last: 10 }), remote: state({ box: 4 }) };
    const s = afterPull(local, server);
    expect(s.dirty.sort()).toEqual(['newer', 'seeded']);
    expect(s.items.remote).toEqual(server.remote);
  });
});
