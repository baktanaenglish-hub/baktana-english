/**
 * Validation and merge of uploaded spaced-repetition state. Used by the Express server
 * (PUT /api/srs), the Supabase client path (src/lib/cloud.ts) and the client after a pull.
 * Spec: docs/spec/v2.md §6.3. Owned by the backend agent.
 *
 * The Supabase RPC `merge_srs` (supabase/schema.sql) implements the same merge rule in SQL.
 */
import { isItemKey } from './item-keys';
import { MAX_BOX, MAX_DUE_AHEAD_DAYS, MAX_ITEMS_PER_USER, type Box, type ItemState, type ItemStates } from './srs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Local calendar date (YYYY-MM-DD) of `time` – same as dateKey() in src/lib/progress.ts. */
function localDateKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Moves a YYYY-MM-DD key by whole days (calendar arithmetic, independent of time zone). */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && shiftKey(value, 0) === value;
}

/** One state, or null when any field is invalid. `last` after `now` is lowered to `now`. */
function sanitizeItemState(value: unknown, now: number, latestDue: string): ItemState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { box, due, seen, wrong, last } = value as Record<string, unknown>;
  if (!isCount(box) || box > MAX_BOX) return null;
  if (!isDateKey(due) || due > latestDue) return null;
  if (!isCount(seen) || !isCount(wrong) || !isCount(last)) return null;
  return { box: box as Box, due, seen, wrong, last: Math.min(last, now) };
}

/**
 * Validates untrusted item states: keeps only valid item keys (isItemKey), boxes 0–5,
 * real YYYY-MM-DD dates no more than MAX_DUE_AHEAD_DAYS ahead, non-negative integers,
 * `last` not after `now`; at most `limit` entries. Returns null if `input` is not an object.
 * Invalid entries are dropped one by one (the rest of the upload is kept).
 */
export function sanitizeItemStates(input: unknown, now = Date.now(), limit = MAX_ITEMS_PER_USER): ItemStates | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  // A day of slack: the learner's local date may be ahead of the server's.
  const latestDue = shiftKey(localDateKey(now), MAX_DUE_AHEAD_DAYS + 1);
  const out: ItemStates = {};
  let count = 0;
  for (const [key, value] of Object.entries(input)) {
    if (count >= limit) break;
    if (!isItemKey(key)) continue;
    const state = sanitizeItemState(value, now, latestDue);
    if (!state) continue;
    out[key] = state;
    count++;
  }
  return out;
}

/**
 * Merges one item: the state with the newer `last` wins (box, due, last);
 * on equal `last` the lower box wins; `seen` and `wrong` are the maximum of both.
 */
export function mergeItemState(a: ItemState, b: ItemState): ItemState {
  const winner = b.last > a.last || (b.last === a.last && b.box < a.box) ? b : a;
  return {
    box: winner.box,
    due: winner.due,
    last: Math.max(a.last, b.last),
    seen: Math.max(a.seen, b.seen),
    wrong: Math.max(a.wrong, b.wrong),
  };
}

/** Merges two maps item by item with mergeItemState (keys present on one side are kept). */
export function mergeItemStates(stored: ItemStates, incoming: ItemStates): ItemStates {
  const out: ItemStates = { ...stored };
  for (const [key, state] of Object.entries(incoming)) {
    const current = out[key];
    out[key] = current ? mergeItemState(current, state) : state;
  }
  return out;
}

/** True when both states are field-for-field equal. */
export function sameItemState(a: ItemState | undefined, b: ItemState | undefined): boolean {
  if (!a || !b) return a === b;
  return a.box === b.box && a.due === b.due && a.seen === b.seen && a.wrong === b.wrong && a.last === b.last;
}

/**
 * Applies an already sanitized upload to the stored state (PUT /api/srs; `merge_srs` in
 * supabase/schema.sql does the same in SQL): merges per item and returns the full new state
 * plus the items that changed and must be written. Keys new to the learner are only added
 * while the total stays within `limit` (in key order); the rest are not saved.
 */
export function applySrsUpload(
  stored: ItemStates,
  incoming: ItemStates,
  limit = MAX_ITEMS_PER_USER,
): { items: ItemStates; changed: ItemStates } {
  let room = Math.max(0, limit - Object.keys(stored).length);
  const items: ItemStates = { ...stored };
  const changed: ItemStates = {};
  for (const key of Object.keys(incoming).sort()) {
    const current = stored[key];
    if (!current) {
      if (room <= 0) continue;
      room--;
    }
    const next = current ? mergeItemState(current, incoming[key]) : incoming[key];
    if (sameItemState(current, next)) continue;
    items[key] = next;
    changed[key] = next;
  }
  return { items, changed };
}
