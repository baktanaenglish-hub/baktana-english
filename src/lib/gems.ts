/**
 * Gems 💎: a per-device reward currency. Earned for lessons, reviews, the daily goal, unit tests,
 * daily quests and a daily chest; spent in the shop on bonus hearts, streak freezes and avatars.
 * Kept in localStorage only, so the progress contract with the server stays unchanged.
 */
import { useCallback, useEffect, useState } from 'react';
import { dateKey, shiftDateKey, type Progress } from './progress';
import type { Rng } from './random';

export const GEMS_KEY = 'baktana-english:gems:v1';

export const LESSON_GEMS = 5;
export const FLAWLESS_BONUS_GEMS = 5;
export const REVIEW_GEMS = 3;
export const GOAL_GEMS = 10;
export const UNIT_TEST_GEMS = 20;
export const ALL_QUESTS_BONUS_GEMS = 20;
/** Bonus hearts are spent before regular ones; at most this many can be stocked. */
export const MAX_BONUS_HEARTS = 10;
export const MAX_FREEZES = 2;

export type QuestId = 'lessons' | 'perfect' | 'review';

export interface Quest {
  id: QuestId;
  icon: string;
  title: string;
  goal: number;
  gems: number;
}

/** The same three quests every day; progress starts over at midnight. */
export const QUESTS: Quest[] = [
  { id: 'lessons', icon: '📚', title: 'השלימו 2 שיעורים', goal: 2, gems: 10 },
  { id: 'perfect', icon: '🎯', title: 'שיעור בלי אף טעות', goal: 1, gems: 15 },
  { id: 'review', icon: '🧠', title: 'חזרה או תרגול אחד', goal: 1, gems: 10 },
];

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  price: number;
}

export const AVATARS: Avatar[] = [
  { id: 'fox', emoji: '🦊', name: 'שועל', price: 40 },
  { id: 'panda', emoji: '🐼', name: 'פנדה', price: 60 },
  { id: 'cat', emoji: '🐱', name: 'חתול', price: 60 },
  { id: 'lion', emoji: '🦁', name: 'אריה', price: 100 },
  { id: 'owl', emoji: '🦉', name: 'ינשוף', price: 120 },
  { id: 'unicorn', emoji: '🦄', name: 'חד־קרן', price: 180 },
  { id: 'dragon', emoji: '🐉', name: 'דרקון', price: 250 },
  { id: 'rocket', emoji: '🚀', name: 'טיל', price: 300 },
  { id: 'crown', emoji: '👑', name: 'מלך/ת האנגלית', price: 500 },
];

export type ShopItemId = 'hearts' | 'freeze';

export interface ShopItem {
  id: ShopItemId;
  icon: string;
  title: string;
  description: string;
  price: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'hearts',
    icon: '❤️',
    title: '3 לבבות בונוס',
    description: 'נוספים על הלבבות הרגילים ונגמרים ראשונים',
    price: 30,
  },
  {
    id: 'freeze',
    icon: '🧊',
    title: 'הקפאת רצף',
    description: 'יום שפספסתם לא ישבור את הרצף (עד 2 במלאי)',
    price: 50,
  },
];

export interface GemState {
  gems: number;
  /** All gems ever earned (shown in the profile). */
  earned: number;
  /** Local date the daily chest was last opened, and how many days in a row. */
  chestDate: string | null;
  chestStreak: number;
  /** The date `quests` and `claimed` belong to. */
  questDate: string | null;
  quests: Record<QuestId, number>;
  claimed: QuestId[];
  bonusHearts: number;
  freezes: number;
  avatars: string[];
  /** The chosen avatar id, or null for the default. */
  avatar: string | null;
  /** Arcade games (see games.ts). */
  games: GameStats;
}

export type GameId = 'rush' | 'memory';
export const GAME_IDS: GameId[] = ['rush', 'memory'];

export interface GameStats {
  /** Games bought with gems. */
  unlocked: GameId[];
  /** The date `plays` belongs to. */
  date: string | null;
  /** Games played today. */
  plays: Record<GameId, number>;
  /** Best score ever. */
  best: Record<GameId, number>;
}

export interface Reward {
  icon: string;
  label: string;
  gems: number;
}

const NO_QUESTS: Record<QuestId, number> = { lessons: 0, perfect: 0, review: 0 };

export function initialGems(): GemState {
  return {
    gems: 0,
    earned: 0,
    chestDate: null,
    chestStreak: 0,
    questDate: null,
    quests: { ...NO_QUESTS },
    claimed: [],
    bonusHearts: 0,
    freezes: 0,
    avatars: [],
    avatar: null,
    games: { unlocked: [], date: null, plays: { rush: 0, memory: 0 }, best: { rush: 0, memory: 0 } },
  };
}

const count = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0;
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const QUEST_IDS = QUESTS.map((q) => q.id);
const AVATAR_IDS = AVATARS.map((a) => a.id);

/** Parses the saved state, ignoring anything unknown or malformed. */
export function parseGems(raw: string | null): GemState {
  if (!raw) return initialGems();
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return initialGems();
    const quests = (data.quests && typeof data.quests === 'object' ? data.quests : {}) as Record<string, unknown>;
    const ids = (v: unknown, known: string[]) =>
      Array.isArray(v) ? [...new Set(v.filter((id): id is string => known.includes(id)))] : [];
    const avatars = ids(data.avatars, AVATAR_IDS);
    const games = (data.games && typeof data.games === 'object' ? data.games : {}) as Record<string, unknown>;
    const perGame = (v: unknown) => {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      return { rush: count(o.rush), memory: count(o.memory) };
    };
    return {
      gems: count(data.gems),
      earned: count(data.earned),
      chestDate: date(data.chestDate),
      chestStreak: count(data.chestStreak),
      questDate: date(data.questDate),
      quests: { lessons: count(quests.lessons), perfect: count(quests.perfect), review: count(quests.review) },
      claimed: ids(data.claimed, QUEST_IDS) as QuestId[],
      bonusHearts: count(data.bonusHearts, MAX_BONUS_HEARTS),
      freezes: count(data.freezes, MAX_FREEZES),
      avatars,
      avatar: typeof data.avatar === 'string' && avatars.includes(data.avatar) ? data.avatar : null,
      games: {
        unlocked: ids(games.unlocked, GAME_IDS) as GameId[],
        date: date(games.date),
        plays: perGame(games.plays),
        best: perGame(games.best),
      },
    };
  } catch {
    return initialGems();
  }
}

/** Starts the quests over on a new day. */
export function forToday(s: GemState, today: string): GemState {
  if (s.questDate === today) return s;
  return { ...s, questDate: today, quests: { ...NO_QUESTS }, claimed: [] };
}

export function earn(s: GemState, gems: number): GemState {
  return { ...s, gems: s.gems + gems, earned: s.earned + gems };
}

/** Adds quest progress and pays out every quest it completes (plus a bonus for finishing all three). */
function advanceQuests(s: GemState, add: Partial<Record<QuestId, number>>, rewards: Reward[]): GemState {
  let next: GemState = { ...s, quests: { ...s.quests } };
  for (const quest of QUESTS) {
    const amount = add[quest.id] ?? 0;
    if (amount <= 0) continue;
    next.quests[quest.id] = Math.min(quest.goal, next.quests[quest.id] + amount);
    if (next.quests[quest.id] >= quest.goal && !next.claimed.includes(quest.id)) {
      next = earn({ ...next, claimed: [...next.claimed, quest.id] }, quest.gems);
      rewards.push({ icon: quest.icon, label: `משימה הושלמה: ${quest.title}`, gems: quest.gems });
      if (next.claimed.length === QUESTS.length) {
        next = earn(next, ALL_QUESTS_BONUS_GEMS);
        rewards.push({ icon: '🏅', label: 'בונוס: כל המשימות של היום!', gems: ALL_QUESTS_BONUS_GEMS });
      }
    }
  }
  return next;
}

export interface Activity {
  kind: 'lesson' | 'review' | 'practice';
  /** No mistakes at all. */
  flawless: boolean;
  /** This session crossed today's daily goal. */
  goalReached: boolean;
}

/** Gems for a finished lesson or review, with the quests it advanced. */
export function rewardActivity(
  s: GemState,
  activity: Activity,
  today = dateKey(Date.now()),
): { state: GemState; rewards: Reward[] } {
  const rewards: Reward[] = [];
  let next = forToday(s, today);
  if (activity.kind === 'lesson') {
    rewards.push({ icon: '📘', label: 'שיעור הושלם', gems: LESSON_GEMS });
    if (activity.flawless) rewards.push({ icon: '✨', label: 'בלי אף טעות', gems: FLAWLESS_BONUS_GEMS });
  } else {
    rewards.push({ icon: '🧠', label: activity.kind === 'review' ? 'חזרה הושלמה' : 'תרגול הושלם', gems: REVIEW_GEMS });
  }
  if (activity.goalReached) rewards.push({ icon: '🎯', label: 'עמדתם ביעד היומי', gems: GOAL_GEMS });
  next = earn(
    next,
    rewards.reduce((sum, r) => sum + r.gems, 0),
  );
  next = advanceQuests(
    next,
    activity.kind === 'lesson' ? { lessons: 1, perfect: activity.flawless ? 1 : 0 } : { review: 1 },
    rewards,
  );
  return { state: next, rewards };
}

/** Gems for passing a unit test for the first time. */
export function rewardUnitTest(s: GemState): { state: GemState; rewards: Reward[] } {
  return {
    state: earn(s, UNIT_TEST_GEMS),
    rewards: [{ icon: '👑', label: 'עברתם מבחן יחידה', gems: UNIT_TEST_GEMS }],
  };
}

export function chestAvailable(s: GemState, today = dateKey(Date.now())): boolean {
  return s.chestDate !== today;
}

/** The chest's opening streak if it were opened today. */
export function nextChestStreak(s: GemState, today = dateKey(Date.now())): number {
  if (s.chestDate === today) return s.chestStreak;
  return s.chestDate === shiftDateKey(today, -1) ? s.chestStreak + 1 : 1;
}

/** Opens today's chest: 5–15 gems, plus 2 for every day in a row it was opened (up to a week). */
export function openChest(
  s: GemState,
  rng: Rng = Math.random,
  today = dateKey(Date.now()),
): { state: GemState; amount: number } | null {
  if (!chestAvailable(s, today)) return null;
  const chestStreak = nextChestStreak(s, today);
  const amount = 5 + Math.floor(rng() * 11) + 2 * Math.min(6, chestStreak - 1);
  return { state: earn({ ...s, chestDate: today, chestStreak }, amount), amount };
}

/** True when the item can be bought now (enough gems and room in stock). */
export function canBuy(s: GemState, id: ShopItemId): boolean {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item || s.gems < item.price) return false;
  if (id === 'hearts') return s.bonusHearts < MAX_BONUS_HEARTS;
  return s.freezes < MAX_FREEZES;
}

export function buy(s: GemState, id: ShopItemId): GemState | null {
  if (!canBuy(s, id)) return null;
  const price = SHOP_ITEMS.find((i) => i.id === id)!.price;
  if (id === 'hearts')
    return { ...s, gems: s.gems - price, bonusHearts: Math.min(MAX_BONUS_HEARTS, s.bonusHearts + 3) };
  return { ...s, gems: s.gems - price, freezes: s.freezes + 1 };
}

/** Buys an avatar (or just selects one already owned). */
export function chooseAvatar(s: GemState, id: string): GemState | null {
  if (s.avatars.includes(id)) return { ...s, avatar: id };
  const avatar = AVATARS.find((a) => a.id === id);
  if (!avatar || s.gems < avatar.price) return null;
  return { ...s, gems: s.gems - avatar.price, avatars: [...s.avatars, id], avatar: id };
}

export function avatarEmoji(s: GemState): string | null {
  return AVATARS.find((a) => a.id === s.avatar)?.emoji ?? null;
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
function daysBetween(from: string, to: string): number {
  const ms = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/**
 * Uses streak freezes to cover the days missed since the last active day: the streak survives
 * as if the learner practised yesterday. Null when nothing is missed, there's no streak, or there
 * aren't enough freezes for every missed day.
 */
export function applyStreakFreeze(
  p: Progress,
  freezes: number,
  now = Date.now(),
): { progress: Progress; used: number } | null {
  if (!p.lastActiveDate || p.streak <= 0 || freezes <= 0) return null;
  const yesterday = shiftDateKey(dateKey(now), -1);
  const missed = daysBetween(p.lastActiveDate, yesterday);
  if (missed <= 0 || missed > freezes) return null;
  return { progress: { ...p, lastActiveDate: yesterday, xpToday: 0 }, used: missed };
}

function load(): GemState {
  try {
    return parseGems(localStorage.getItem(GEMS_KEY));
  } catch {
    return initialGems();
  }
}

/** Gem state persisted in localStorage. */
export function useGems() {
  const [gems, setGems] = useState<GemState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(GEMS_KEY, JSON.stringify(gems));
    } catch {
      // Ignore – gems just won't persist.
    }
  }, [gems]);

  const update = useCallback((fn: (s: GemState) => GemState) => setGems(fn), []);
  const reset = useCallback(() => setGems(initialGems()), []);
  return { gems, update, reset };
}
