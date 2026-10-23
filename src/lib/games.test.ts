import { describe, expect, it } from 'vitest';
import { course } from '../data/course';
import { initialGems, type GemState } from './gems';
import {
  REWARDED_PLAYS,
  RECORD_BONUS_GEMS,
  finishGame,
  gameUnlocked,
  memoryDeck,
  memoryScore,
  rushPoints,
  rushQuestion,
  unlockGame,
  wordPool,
} from './games';
import { initialProgress } from './progress';
import { seededRng } from './random';

const TODAY = '2026-10-21';
const fresh = initialProgress();
const unit1Done = { ...fresh, completed: Object.fromEntries(course[0].lessons.map((l) => [l.id, 1])) };

describe('unlocking', () => {
  it('opens the word rush once every lesson of unit 1 is done', () => {
    expect(gameUnlocked(initialGems(), fresh, 'rush')).toBe(false);
    const most = { ...fresh, completed: { [course[0].lessons[0].id]: 1 } };
    expect(gameUnlocked(initialGems(), most, 'rush')).toBe(false);
    expect(gameUnlocked(initialGems(), unit1Done, 'rush')).toBe(true);
  });

  it('sells the memory game for gems, once', () => {
    expect(gameUnlocked(initialGems(), unit1Done, 'memory')).toBe(false);
    expect(unlockGame({ ...initialGems(), gems: 99 }, 'memory')).toBeNull();
    const s = unlockGame({ ...initialGems(), gems: 150 }, 'memory')!;
    expect(s.gems).toBe(50);
    expect(gameUnlocked(s, fresh, 'memory')).toBe(true);
    expect(unlockGame(s, 'memory')).toBeNull();
    // The rush is earned by progress, not sold.
    expect(unlockGame({ ...initialGems(), gems: 999 }, 'rush')).toBeNull();
  });
});

describe('word pool and questions', () => {
  it('uses the completed lessons and tops up with unit 1', () => {
    expect(wordPool(fresh).length).toBeGreaterThanOrEqual(6);
    const pool = wordPool(unit1Done);
    expect(new Set(pool.map((w) => w.en)).size).toBe(pool.length);
  });

  it('asks a word with its meaning among four distinct options, never twice in a row', () => {
    const pool = wordPool(unit1Done);
    const rng = seededRng(7);
    let prev: string | undefined;
    for (let i = 0; i < 50; i++) {
      const q = rushQuestion(pool, rng, prev);
      expect(q.word.en).not.toBe(prev);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.word.he);
      prev = q.word.en;
    }
  });

  it('scores a combo up to x5', () => {
    expect([1, 2, 5, 9].map(rushPoints)).toEqual([10, 20, 50, 50]);
  });

  it('deals six pairs for the memory game', () => {
    const deck = memoryDeck(wordPool(fresh), seededRng(1));
    expect(deck).toHaveLength(12);
    for (let pair = 0; pair < 6; pair++) expect(deck.filter((c) => c.pair === pair)).toHaveLength(2);
    expect(memoryScore(6)).toBe(100);
    expect(memoryScore(10)).toBe(68);
    expect(memoryScore(100)).toBe(10);
  });
});

describe('finishGame', () => {
  it('pays the first games of the day and keeps the high score', () => {
    let s: GemState = initialGems();
    const first = finishGame(s, 'rush', 300, TODAY);
    expect(first.rewards).toEqual([{ icon: '⚡', label: '300 נקודות', gems: 15 }]);
    expect(first.record).toBe(true);
    s = first.state;
    const better = finishGame(s, 'rush', 400, TODAY);
    expect(better.rewards.at(-1)?.gems).toBe(RECORD_BONUS_GEMS);
    s = better.state;
    for (let i = 2; i < REWARDED_PLAYS; i++) s = finishGame(s, 'rush', 100, TODAY).state;
    const unpaid = finishGame(s, 'rush', 900, TODAY);
    expect(unpaid.rewards).toEqual([]);
    expect(unpaid.state.games.best.rush).toBe(900);
    // A new day pays again.
    expect(finishGame(unpaid.state, 'rush', 100, '2026-10-22').rewards).toHaveLength(1);
  });
});
