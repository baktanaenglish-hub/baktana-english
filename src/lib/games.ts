/**
 * The arcade 🎮: short games with the words the learner already knows, paid in gems.
 * "מרוץ מילים" opens after unit 1; "זיכרון" is bought once with gems.
 * Only the first few games a day pay gems, so the arcade adds to lessons rather than replacing them.
 */
import { course } from '../data/course';
import type { Word } from '../types';
import { earn, type GameId, type GemState, type Reward } from './gems';
import { dateKey, type Progress } from './progress';
import { shuffle, type Rng } from './random';

export interface GameInfo {
  id: GameId;
  icon: string;
  title: string;
  description: string;
  /** Opens once every lesson of this unit (index in the course) is done, or when bought for gems. */
  unlock: { unit: number } | { price: number };
}

export const GAMES: GameInfo[] = [
  {
    id: 'rush',
    icon: '⚡',
    title: 'מרוץ מילים',
    description: '60 שניות, כמה שיותר מילים. רצף תשובות נכונות מכפיל את הניקוד!',
    unlock: { unit: 0 },
  },
  {
    id: 'memory',
    icon: '🃏',
    title: 'זיכרון',
    description: 'הפכו קלפים ומצאו כל מילה באנגלית עם התרגום שלה – בכמה שפחות צעדים.',
    unlock: { price: 100 },
  },
];

/** Games a day that pay gems; later games are just for fun (and the high score). */
export const REWARDED_PLAYS = 3;
export const RECORD_BONUS_GEMS = 10;

export const RUSH_MS = 60_000;
/** A wrong answer takes this much time off the clock. */
export const RUSH_PENALTY_MS = 3_000;
export const MAX_COMBO = 5;
export const MEMORY_PAIRS = 6;

export function gameInfo(id: GameId): GameInfo {
  return GAMES.find((g) => g.id === id)!;
}

/** Lessons done in the unit a game waits for. */
export function unlockProgress(progress: Progress, game: GameInfo): { done: number; total: number } | null {
  if (!('unit' in game.unlock)) return null;
  const lessons = course[game.unlock.unit]?.lessons ?? [];
  return { done: lessons.filter((l) => (progress.completed[l.id] ?? 0) > 0).length, total: lessons.length };
}

export function gameUnlocked(s: GemState, progress: Progress, id: GameId): boolean {
  if (s.games.unlocked.includes(id)) return true;
  const steps = unlockProgress(progress, gameInfo(id));
  return steps !== null && steps.total > 0 && steps.done >= steps.total;
}

/** Buys a game that is sold for gems. */
export function unlockGame(s: GemState, id: GameId): GemState | null {
  const { unlock } = gameInfo(id);
  if (!('price' in unlock) || s.games.unlocked.includes(id) || s.gems < unlock.price) return null;
  return { ...s, gems: s.gems - unlock.price, games: { ...s.games, unlocked: [...s.games.unlocked, id] } };
}

/** Games played today. */
export function playsToday(s: GemState, id: GameId, today = dateKey(Date.now())): number {
  return s.games.date === today ? s.games.plays[id] : 0;
}

/**
 * The words to play with: those of every completed lesson (one per English word),
 * topped up with unit 1 so there are always enough.
 */
export function wordPool(progress: Progress, min = MEMORY_PAIRS): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  const add = (w: Word) => {
    const key = w.en.toLowerCase();
    if (seen.has(key) || out.some((o) => o.he === w.he)) return;
    seen.add(key);
    out.push(w);
  };
  for (const unit of course) {
    for (const lesson of unit.lessons) if ((progress.completed[lesson.id] ?? 0) > 0) lesson.words.forEach(add);
  }
  if (out.length < min) course[0].lessons.flatMap((l) => l.words).forEach(add);
  return out;
}

export interface RushQuestion {
  word: Word;
  options: string[];
}

/** An English word and four Hebrew meanings to pick from; not the same word twice in a row. */
export function rushQuestion(pool: readonly Word[], rng: Rng = Math.random, previous?: string): RushQuestion {
  const candidates = pool.length > 1 ? pool.filter((w) => w.en !== previous) : pool;
  const word = candidates[Math.floor(rng() * candidates.length)];
  const others = shuffle(
    pool.filter((w) => w.he !== word.he),
    rng,
  )
    .slice(0, 3)
    .map((w) => w.he);
  return { word, options: shuffle([word.he, ...others], rng) };
}

/** Points for a right answer at this combo (1 = the first in a row). */
export function rushPoints(combo: number): number {
  return 10 * Math.min(MAX_COMBO, Math.max(1, combo));
}

export interface MemoryCard {
  id: number;
  pair: number;
  text: string;
  lang: 'en' | 'he';
}

/** Six words, each as an English and a Hebrew card, shuffled. */
export function memoryDeck(pool: readonly Word[], rng: Rng = Math.random, pairs = MEMORY_PAIRS): MemoryCard[] {
  const words = shuffle(pool, rng).slice(0, pairs);
  const cards = words.flatMap((w, pair) => [
    { pair, text: w.en, lang: 'en' as const },
    { pair, text: w.he, lang: 'he' as const },
  ]);
  return shuffle(cards, rng).map((c, id) => ({ ...c, id }));
}

/** Memory score: 100 for a perfect game (one move per pair), 8 less for every extra move. */
export function memoryScore(moves: number, pairs = MEMORY_PAIRS): number {
  return Math.max(10, 100 - 8 * Math.max(0, moves - pairs));
}

/** Gems for a game's score (before the daily limit). */
export function gameGems(id: GameId, score: number): number {
  return id === 'rush' ? Math.min(30, Math.floor(score / 20)) : Math.min(20, Math.floor(score / 5));
}

/**
 * Records a finished game: counts the play, keeps the high score and, for the first
 * REWARDED_PLAYS games of the day, pays gems (plus a bonus for beating the record).
 */
export function finishGame(
  s: GemState,
  id: GameId,
  score: number,
  today = dateKey(Date.now()),
): { state: GemState; rewards: Reward[]; record: boolean } {
  const plays = playsToday(s, id, today);
  const best = s.games.best[id];
  const record = score > best;
  const rewards: Reward[] = [];
  if (plays < REWARDED_PLAYS) {
    const gems = gameGems(id, score);
    if (gems > 0) rewards.push({ icon: gameInfo(id).icon, label: `${score} נקודות`, gems });
    if (record && best > 0) rewards.push({ icon: '🏆', label: 'שיא חדש!', gems: RECORD_BONUS_GEMS });
  }
  const games = {
    ...s.games,
    date: today,
    plays: { ...(s.games.date === today ? s.games.plays : { rush: 0, memory: 0 }), [id]: plays + 1 },
    best: { ...s.games.best, [id]: Math.max(best, score) },
  };
  const state = earn(
    { ...s, games },
    rewards.reduce((sum, r) => sum + r.gems, 0),
  );
  return { state, rewards, record };
}
