/**
 * Spaced-repetition (Leitner) contract shared by the client (src/lib/srs.ts), the Express
 * server and the Supabase backend. Spec: docs/spec/v2.md §6.3.
 * Contract file – owned by the backend agent, changes are additive only.
 */

/** Leitner box: 0 = new / just missed, 5 = known. */
export type Box = 0 | 1 | 2 | 3 | 4 | 5;

export const MAX_BOX: Box = 5;

/** Days until the next review after landing in box N (index = box). */
export const SRS_INTERVAL_DAYS: readonly number[] = [0, 1, 3, 7, 16, 35];

/** Learning state of one item (word or sentence), keyed by its item key. */
export interface ItemState {
  box: Box;
  /** Local date (YYYY-MM-DD) from which the item is due. */
  due: string;
  /** Number of sessions the item was answered in. */
  seen: number;
  /** Number of sessions the item was answered wrong in. */
  wrong: number;
  /** ms timestamp of the last answer – decides merges ("newer last wins"). */
  last: number;
}

/** item key (`w:…` / `s:…`, see shared/item-keys.ts) → state. */
export type ItemStates = Record<string, ItemState>;

/** Exercises in one review session. */
export const REVIEW_LENGTH = 10;
/** XP for finishing a review session (same as the old practice). */
export const REVIEW_XP = 10;
/** The path pins a review card once at least this many items are due. */
export const REVIEW_PIN_THRESHOLD = 3;
/** Upper bounds enforced by sanitizeItemStates() and both backends. */
export const MAX_ITEMS_PER_USER = 3000;
export const MAX_ITEMS_PER_REQUEST = 1000;
/** `due` may be at most this many days after today. */
export const MAX_DUE_AHEAD_DAYS = 400;
/** Seeding spreads existing learners' items over today … today + SEED_SPREAD_DAYS. */
export const SEED_SPREAD_DAYS = 6;
