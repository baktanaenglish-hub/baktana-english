/**
 * Validation and merge rules for uploaded progress. Shared by the Express server and
 * the Supabase backend (src/lib/cloud.ts), so both treat uploads exactly alike.
 */
import { allLessons } from '../src/data/course';
import { MAX_HEARTS, dateKey, refresh, shiftDateKey, type Progress } from '../src/lib/progress';

export const MAX_TOTAL_XP = 10_000_000;
/** Upper bound for XP from a single lesson (the client awards 10–15). */
export const MAX_LESSON_XP = 50;
const MAX_COUNT = 100_000;
/** At most this many entries are kept in `completed` (docs/spec/v2.md §6.7.2). */
export const MAX_COMPLETED_KEYS = 500;
/** Shape of lesson and checkpoint ids (`u7l1`, `u12cp`), also those of newer course versions. */
export const LESSON_ID_RE = /^u\d{1,2}(l\d{1,2}|cp)$/;
const lessonIds = new Set(allLessons.map((l) => l.id));

/** True for ids kept in `completed`: known lessons, or ids shaped like a lesson of a newer client. */
export function isKeepableLessonId(id: string): boolean {
  return lessonIds.has(id) || LESSON_ID_RE.test(id);
}

/** Keeps at most MAX_COMPLETED_KEYS entries; known lessons first, so only foreign ids are dropped. */
function capCompleted(completed: Record<string, number>): Record<string, number> {
  const ids = Object.keys(completed);
  if (ids.length <= MAX_COMPLETED_KEYS) return completed;
  const ordered = [...ids.filter((id) => lessonIds.has(id)), ...ids.filter((id) => !lessonIds.has(id))];
  return Object.fromEntries(ordered.slice(0, MAX_COMPLETED_KEYS).map((id) => [id, completed[id]]));
}

const isNonNegNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const clampInt = (v: number, max: number) => Math.min(max, Math.floor(v));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A client-reported local date, if plausible: a real calendar date within one
 * day of the server's date (learners' time zones differ from the server's by
 * less than a day). Returns null otherwise.
 */
export function plausibleLocalDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  if (shiftDateKey(value, 0) !== value) return null; // e.g. 2026-02-31
  const today = dateKey(now);
  return value >= shiftDateKey(today, -1) && value <= shiftDateKey(today, 1) ? value : null;
}

/**
 * Validates an untrusted Progress (e.g. from PUT /api/progress) and clamps it
 * to sane values. Lesson ids unknown to this version are kept when they look like lesson
 * ids (a newer client wrote them – docs/spec/v2.md §6.7.2), up to MAX_COMPLETED_KEYS
 * entries; anything else (e.g. `__practice__`) is dropped. Returns null if malformed.
 */
export function sanitizeProgress(input: unknown, now = Date.now()): Progress | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const p = input as Record<string, unknown>;
  const { xp, completed, streak, lastActiveDate, xpToday, hearts, heartsUpdatedAt, resetAt } = p;
  if (!isNonNegNumber(xp) || !isNonNegNumber(streak) || !isNonNegNumber(xpToday)) return null;
  if (!isNonNegNumber(hearts) || !isNonNegNumber(heartsUpdatedAt)) return null;
  if (lastActiveDate !== null && (typeof lastActiveDate !== 'string' || !DATE_RE.test(lastActiveDate))) {
    return null;
  }
  // A date in the future (wrong device clock, tampering) would win every later merge
  // and freeze the streak, so the day fields of such an upload are dropped.
  const future = lastActiveDate !== null && lastActiveDate > shiftDateKey(dateKey(now), 1);
  if (!completed || typeof completed !== 'object' || Array.isArray(completed)) return null;
  const cleanCompleted: Record<string, number> = {};
  const entries = Object.entries(completed);
  if (!entries.every(([, count]) => isNonNegNumber(count))) return null;
  for (const [id, count] of entries as [string, number][]) {
    if (count >= 1 && isKeepableLessonId(id)) cleanCompleted[id] = clampInt(count, MAX_COUNT);
  }
  return {
    xp: clampInt(xp, MAX_TOTAL_XP),
    completed: capCompleted(cleanCompleted),
    streak: future ? 0 : clampInt(streak, MAX_COUNT),
    lastActiveDate: future ? null : lastActiveDate,
    xpToday: future ? 0 : clampInt(xpToday, MAX_TOTAL_XP),
    hearts: clampInt(hearts, MAX_HEARTS),
    heartsUpdatedAt: Math.min(heartsUpdatedAt, now),
    // A reset "in the future" would make the copy win every later merge, so it is capped at now.
    ...(isNonNegNumber(resetAt) && resetAt > 0 ? { resetAt: Math.min(Math.floor(resetAt), now) } : {}),
  };
}

/**
 * Merges stored and uploaded progress (rules from shared/api.ts):
 * - xp: the maximum;
 * - completed: union of lessons, keeping the higher count;
 * - lastActiveDate: the later one, together with its streak and xpToday
 *   (same date → the higher of each);
 * - hearts: after applying refills to both, the lower count with its clock
 *   (conservative, so syncing can't refill hearts).
 * A progress reset comes first: the copy with the newer `resetAt` wins outright, so an upload
 * from a device that still holds the progress from before the reset is ignored.
 */
export function mergeProgress(stored: Progress, incoming: Progress, now = Date.now()): Progress {
  const a = refresh(stored, now);
  const b = refresh(incoming, now);
  const resetA = a.resetAt ?? 0;
  const resetB = b.resetAt ?? 0;
  if (resetB > resetA) return b;
  if (resetA > resetB) return a;

  const completed: Record<string, number> = { ...a.completed };
  for (const [id, count] of Object.entries(b.completed)) {
    completed[id] = Math.max(completed[id] ?? 0, count);
  }

  const da = a.lastActiveDate ?? '';
  const dbb = b.lastActiveDate ?? '';
  let streak: number;
  let xpToday: number;
  let lastActiveDate: string | null;
  if (da === dbb) {
    lastActiveDate = a.lastActiveDate;
    streak = Math.max(a.streak, b.streak);
    xpToday = Math.max(a.xpToday, b.xpToday);
  } else {
    const later = da > dbb ? a : b;
    ({ lastActiveDate, streak, xpToday } = later);
  }

  let hearts = a.hearts;
  let heartsUpdatedAt = a.heartsUpdatedAt;
  if (b.hearts < a.hearts || (b.hearts === a.hearts && b.heartsUpdatedAt > a.heartsUpdatedAt)) {
    hearts = b.hearts;
    heartsUpdatedAt = b.heartsUpdatedAt;
  }

  return {
    xp: Math.max(a.xp, b.xp),
    completed: capCompleted(completed),
    streak,
    lastActiveDate,
    xpToday,
    hearts,
    heartsUpdatedAt,
    ...(resetA > 0 ? { resetAt: resetA } : {}),
  };
}
