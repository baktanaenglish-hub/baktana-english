import { allLessons } from '../data/course';

export const MAX_HEARTS = 5;
export const HEART_REFILL_MS = 30 * 60 * 1000;
export const DAILY_GOAL_XP = 30;

export interface Progress {
  xp: number;
  /** Lesson id → number of times completed. */
  completed: Record<string, number>;
  streak: number;
  /** Local date (YYYY-MM-DD) of the last completed lesson. */
  lastActiveDate: string | null;
  xpToday: number;
  hearts: number;
  /** Timestamp the heart refill clock counts from. */
  heartsUpdatedAt: number;
  /** Daily XP goal chosen in onboarding. Missing in older saves – fall back to DAILY_GOAL_XP. */
  dailyGoal?: number;
  /**
   * When the signed-in learner last reset their progress (ms). A newer reset wins every merge
   * outright, so another device's older copy can't bring the old progress back.
   */
  resetAt?: number;
}

/**
 * A signed-in learner's reset: fresh progress stamped with `resetAt`, keeping the daily goal.
 * Merges let the newest reset win, so older copies elsewhere don't bring the progress back.
 */
export function resetProgress(p: Progress, now = Date.now()): Progress {
  return { ...initialProgress(now), ...(p.dailyGoal ? { dailyGoal: p.dailyGoal } : {}), resetAt: now };
}

export function initialProgress(now = Date.now()): Progress {
  return {
    xp: 0,
    completed: {},
    streak: 0,
    lastActiveDate: null,
    xpToday: 0,
    hearts: MAX_HEARTS,
    heartsUpdatedAt: now,
  };
}

export function dateKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Moves a `YYYY-MM-DD` key by whole days (calendar arithmetic, independent of time zone). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function previousDateKey(time: number): string {
  return shiftDateKey(dateKey(time), -1);
}

/**
 * Applies hearts that refilled over time and resets the daily XP on a new day.
 * `today` is the learner's local date; the server passes the date the client reported.
 */
export function refresh(p: Progress, now = Date.now(), today = dateKey(now)): Progress {
  let next = p;
  if (p.hearts < MAX_HEARTS) {
    const gained = Math.floor((now - p.heartsUpdatedAt) / HEART_REFILL_MS);
    if (gained > 0) {
      const hearts = Math.min(MAX_HEARTS, p.hearts + gained);
      next = { ...next, hearts, heartsUpdatedAt: p.heartsUpdatedAt + gained * HEART_REFILL_MS };
    }
  }
  if (p.lastActiveDate !== today && p.xpToday !== 0) {
    next = { ...next, xpToday: 0 };
  }
  return next;
}

/** The streak as it should be shown: it is lost once a whole day was skipped. */
export function visibleStreak(p: Progress, now = Date.now()): number {
  if (p.lastActiveDate === dateKey(now) || p.lastActiveDate === previousDateKey(now)) return p.streak;
  return 0;
}

export function msUntilNextHeart(p: Progress, now = Date.now()): number {
  if (p.hearts >= MAX_HEARTS) return 0;
  return Math.max(0, p.heartsUpdatedAt + HEART_REFILL_MS - now);
}

export function loseHeart(p: Progress, now = Date.now()): Progress {
  const current = refresh(p, now);
  if (current.hearts === 0) return current;
  return {
    ...current,
    hearts: current.hearts - 1,
    // Start the refill clock when dropping below full.
    heartsUpdatedAt: current.hearts === MAX_HEARTS ? now : current.heartsUpdatedAt,
  };
}

export function completeLesson(
  p: Progress,
  lessonId: string,
  xp: number,
  now = Date.now(),
  today = dateKey(now),
): Progress {
  const current = refresh(p, now, today);
  let streak = current.streak;
  if (current.lastActiveDate !== today) {
    streak = current.lastActiveDate === shiftDateKey(today, -1) ? streak + 1 : 1;
  }
  return {
    ...current,
    xp: current.xp + xp,
    xpToday: (current.lastActiveDate === today ? current.xpToday : 0) + xp,
    completed: { ...current.completed, [lessonId]: (current.completed[lessonId] ?? 0) + 1 },
    streak,
    lastActiveDate: today,
  };
}

/** Index (in course order) of the furthest completed lesson, or -1. Unknown ids are ignored. */
function furthestCompletedIndex(p: Progress): number {
  for (let i = allLessons.length - 1; i >= 0; i--) {
    if ((p.completed[allLessons[i].id] ?? 0) > 0) return i;
  }
  return -1;
}

/**
 * Open when first in course, completed, the previous lesson is completed, or any later
 * lesson is completed (high-water mark, so lessons added behind the learner stay open).
 * Ids unknown to this course version (from a newer client) are not taken into account.
 * docs/spec/v2.md §6.7.1.
 */
export function isUnlocked(p: Progress, lessonId: string): boolean {
  const index = allLessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return false;
  if (index === 0) return true;
  if ((p.completed[lessonId] ?? 0) > 0) return true;
  if ((p.completed[allLessons[index - 1].id] ?? 0) > 0) return true;
  return furthestCompletedIndex(p) > index;
}

/**
 * Not completed, but a later lesson is – a lesson added behind the learner's furthest point
 * (shown with a "חדש!" chip). docs/spec/v2.md §6.7.1.
 */
export function isCatchUp(p: Progress, lessonId: string): boolean {
  const index = allLessons.findIndex((l) => l.id === lessonId);
  if (index < 0 || (p.completed[lessonId] ?? 0) > 0) return false;
  return furthestCompletedIndex(p) > index;
}

/**
 * The lesson the path highlights: the first uncompleted lesson after the furthest completed
 * one; if there is none (everything up to the end is done), the first uncompleted overall.
 */
export function currentLessonId(p: Progress): string | undefined {
  const furthest = furthestCompletedIndex(p);
  const after = allLessons.slice(furthest + 1).find((l) => !(p.completed[l.id] > 0));
  return (after ?? allLessons.find((l) => !(p.completed[l.id] > 0)))?.id;
}
