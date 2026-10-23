/**
 * Client spaced-repetition engine: local storage, seeding, box updates, due lists
 * and (Should) sync through /api/srs or Supabase. Spec: docs/spec/v2.md §6.3, §7.2.
 * Owned by the backend agent.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SrsResponse } from '../../shared/api';
import { sentenceKey, wordKey } from '../../shared/item-keys';
import {
  MAX_BOX,
  SEED_SPREAD_DAYS,
  SRS_INTERVAL_DAYS,
  type Box,
  type ItemState,
  type ItemStates,
} from '../../shared/srs';
import { mergeItemStates, sameItemState, sanitizeItemStates } from '../../shared/srs-merge';
import { allLessons } from '../data/course';
import type { ItemAnswer } from '../types';
import { api } from './api';
import { dateKey, shiftDateKey, type Progress } from './progress';
import type { Rng } from './random';

export const SRS_STORAGE_KEY = 'baktana-english:srs:v1';

/** What is kept under SRS_STORAGE_KEY. */
export interface SrsStore {
  v: 1;
  items: ItemStates;
  /** True once existing progress was seeded (or there was nothing to seed). */
  seeded: boolean;
  /** Keys changed since the last successful sync (Should: SRS sync). */
  dirty: string[];
}

/** 'lesson' answers come from a lesson, 'review' answers from a review session. */
export type AnswerMode = 'lesson' | 'review';

export function emptySrs(): SrsStore {
  return { v: 1, items: {}, seeded: false, dirty: [] };
}

/** Validates a parsed store; anything unexpected yields emptySrs(). */
function parseStore(value: unknown, now: number): SrsStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptySrs();
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return emptySrs();
  // No item cap locally: the course holds far fewer items than MAX_ITEMS_PER_USER.
  const items = sanitizeItemStates(raw.items, now, Number.POSITIVE_INFINITY);
  if (!items) return emptySrs();
  const dirty = Array.isArray(raw.dirty)
    ? raw.dirty.filter((k): k is string => typeof k === 'string' && k in items)
    : [];
  return { v: 1, items, seeded: raw.seeded === true, dirty: [...new Set(dirty)] };
}

/** Reads the store; a missing, blocked or corrupt store yields emptySrs(). Never throws. */
export function loadSrs(now = Date.now()): SrsStore {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? parseStore(JSON.parse(raw), now) : emptySrs();
  } catch {
    return emptySrs();
  }
}

/** Writes the store; storage errors are ignored. */
export function saveSrs(store: SrsStore): void {
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode, quota) – the state lasts until reload.
  }
}

/**
 * One-time seeding for learners who finished lessons before this release: every word and
 * sentence of every completed lesson gets box 1, due today + rng-spread 0..SEED_SPREAD_DAYS.
 * Sets `seeded`. Returns the store unchanged if it is already seeded.
 * Seeded items have `last: 0`, so any real state from the server wins a merge, and they are
 * not marked dirty.
 *
 * With nothing completed there is nothing to seed yet, so `seeded` stays false: progress can
 * still arrive later (signing in on a fresh install pulls it from the server). A store that
 * already holds real answers (`last > 0`) belongs to a learner of this release and is only
 * marked as seeded.
 */
export function seedFromProgress(
  store: SrsStore,
  progress: Progress,
  now = Date.now(),
  rng: Rng = Math.random,
): SrsStore {
  if (store.seeded) return store;
  if (Object.values(store.items).some((s) => s.last > 0)) return { ...store, seeded: true };
  if (!allLessons.some((l) => (progress.completed[l.id] ?? 0) >= 1)) return store;
  const today = dateKey(now);
  const items: ItemStates = { ...store.items };
  const seed = (key: string) => {
    if (items[key]) return;
    const spread = Math.min(SEED_SPREAD_DAYS, Math.floor(rng() * (SEED_SPREAD_DAYS + 1)));
    items[key] = { box: 1, due: shiftDateKey(today, spread), seen: 1, wrong: 0, last: 0 };
  };
  for (const lesson of allLessons) {
    if (!((progress.completed[lesson.id] ?? 0) >= 1)) continue;
    for (const word of lesson.words) seed(wordKey(word));
    lesson.sentences.forEach((_, i) => seed(sentenceKey(lesson.id, i)));
  }
  return { ...store, items, seeded: true };
}

/**
 * Applies the answers of one finished session (rules in docs/spec/v2.md §6.3).
 * All answers to the same key are combined into one update: the key counts as correct only
 * if every answer to it was correct, and it can move boxes only if one of them was not from
 * a match exercise. `mode` does not change the rules in this release.
 */
export function applyAnswers(store: SrsStore, answers: ItemAnswer[], _mode: AnswerMode, now = Date.now()): SrsStore {
  if (answers.length === 0) return store;
  const today = dateKey(now);
  const byKey = new Map<string, { correct: boolean; eligible: boolean }>();
  for (const a of answers) {
    if (typeof a.itemKey !== 'string' || !a.itemKey) continue;
    const entry = byKey.get(a.itemKey) ?? { correct: true, eligible: false };
    entry.correct &&= a.correct;
    entry.eligible ||= a.exType !== 'match';
    byKey.set(a.itemKey, entry);
  }
  if (byKey.size === 0) return store;

  const items: ItemStates = { ...store.items };
  for (const [key, { correct, eligible }] of byKey) {
    items[key] = nextState(items[key], correct, eligible, today, now);
  }
  const dirty = [...new Set([...store.dirty, ...byKey.keys()])];
  return { ...store, items, dirty };
}

function nextState(
  prev: ItemState | undefined,
  correct: boolean,
  eligible: boolean,
  today: string,
  now: number,
): ItemState {
  if (!prev) {
    return correct && eligible
      ? { box: 1, due: shiftDateKey(today, SRS_INTERVAL_DAYS[1]), seen: 1, wrong: 0, last: now }
      : { box: 0, due: today, seen: 1, wrong: correct ? 0 : 1, last: now };
  }
  const seen = prev.seen + 1;
  if (!correct) {
    const moved = eligible ? { box: Math.min(prev.box, 1) as Box, due: today } : {};
    return { ...prev, ...moved, seen, wrong: prev.wrong + 1, last: now };
  }
  if (eligible && prev.due <= today) {
    const box = Math.min(prev.box + 1, MAX_BOX) as Box;
    return { ...prev, box, due: shiftDateKey(today, SRS_INTERVAL_DAYS[box]), seen, last: now };
  }
  // Correct but not due yet (or match only): no "cramming" – box and due stay.
  return { ...prev, seen, last: now };
}

const errorRate = (s: ItemState) => s.wrong / Math.max(s.seen, 1);

/** Keys due today or earlier, weakest first (lowest box, then most wrong/seen, then oldest due). */
export function dueKeys(store: SrsStore, now = Date.now()): string[] {
  const today = dateKey(now);
  return Object.entries(store.items)
    .filter(([, s]) => s.due <= today)
    .sort(
      ([ka, a], [kb, b]) =>
        a.box - b.box || errorRate(b) - errorRate(a) || a.due.localeCompare(b.due) || (ka < kb ? -1 : ka > kb ? 1 : 0),
    )
    .map(([key]) => key);
}

export function dueCount(store: SrsStore, now = Date.now()): number {
  return dueKeys(store, now).length;
}

/**
 * Keys that are not due yet but closest to due, weakest first – used to fill a review
 * session when fewer than REVIEW_LENGTH items are due.
 */
export function upcomingKeys(store: SrsStore, limit: number, now = Date.now()): string[] {
  const today = dateKey(now);
  return Object.entries(store.items)
    .filter(([, s]) => s.due > today)
    .sort(([ka, a], [kb, b]) => a.due.localeCompare(b.due) || a.box - b.box || (ka < kb ? -1 : ka > kb ? 1 : 0))
    .slice(0, Math.max(0, limit))
    .map(([key]) => key);
}

// ---- Sync (Should, docs/spec/v2.md §6.3 "useSrs") ----

/** The changed items to upload: the dirty keys that still exist. */
export function dirtyDelta(store: SrsStore): ItemStates {
  const delta: ItemStates = {};
  for (const key of store.dirty) if (store.items[key]) delta[key] = store.items[key];
  return delta;
}

/**
 * After a successful upload of `sent`: merges the server's full state in and clears the
 * sent keys from `dirty` – except those that changed locally while the request was out.
 */
export function afterPush(store: SrsStore, sent: ItemStates, server: ItemStates): SrsStore {
  const items = mergeItemStates(store.items, server);
  const dirty = store.dirty.filter((key) => !(key in sent) || !sameItemState(store.items[key], sent[key]));
  return { ...store, items, dirty };
}

/**
 * After pulling the server's state (sign-in, app start): merges it in and marks every local
 * item that differs from the server copy as dirty, so the next push uploads it.
 */
export function afterPull(store: SrsStore, server: ItemStates): SrsStore {
  const items = mergeItemStates(store.items, server);
  const differing = Object.keys(items).filter((key) => !sameItemState(items[key], server[key]));
  return { ...store, items, dirty: [...new Set([...store.dirty, ...differing])] };
}

/** The backend calls useSrs needs (api.getSrs / api.putSrs). */
export interface SrsClient {
  getSrs: () => Promise<SrsResponse>;
  putSrs: (items: ItemStates) => Promise<SrsResponse>;
  deleteSrs?: () => Promise<void>;
}

/**
 * Drops items answered before a progress reset (`resetAt`, ms) – e.g. on a device that still
 * held the old state when the reset arrived – so they are neither reviewed nor uploaded again.
 */
export function forgetBefore(store: SrsStore, resetAt: number | undefined): SrsStore {
  if (!resetAt) return store;
  const stale = Object.keys(store.items).filter((key) => store.items[key].last < resetAt);
  if (stale.length === 0) return store;
  const items = { ...store.items };
  for (const key of stale) delete items[key];
  return { ...store, items, dirty: store.dirty.filter((key) => !stale.includes(key)) };
}

const serverItems = (res: SrsResponse | undefined) =>
  sanitizeItemStates(res?.items, Date.now(), Number.POSITIVE_INFINITY) ?? {};

export interface SrsApi {
  store: SrsStore;
  /** Number of items due now. */
  due: number;
  /** Records a finished lesson or review session and persists it. */
  record: (answers: ItemAnswer[], mode: AnswerMode) => void;
  /**
   * Forgets all review state on this device (Profile → reset progress) and, when signed in,
   * on the server too.
   */
  reset: () => void;
}

/**
 * React hook used by App.tsx: loads (and seeds) the store, persists every change and,
 * when `signedIn` (App passes `account.user !== null`), syncs in the background (Should).
 * Works offline and for guests; network failures are ignored and retried on the next
 * change, `online` event or start.
 */
export function useSrs(progress: Progress, signedIn = false, client: SrsClient = api): SrsApi {
  const [store, setStore] = useState<SrsStore>(() => seedFromProgress(loadSrs(), progress));
  const storeRef = useRef(store);
  const pushing = useRef(false);

  useEffect(() => {
    storeRef.current = store;
    saveSrs(store);
  }, [store]);

  // Progress that arrives after start-up (pulled from the server on sign-in) is seeded too,
  // after dropping what was answered before a reset made on another device.
  useEffect(() => {
    setStore((s) => seedFromProgress(forgetBefore(s, progress.resetAt), progress));
  }, [progress]);

  const push = useCallback(async () => {
    const delta = dirtyDelta(storeRef.current);
    if (pushing.current || Object.keys(delta).length === 0) return;
    pushing.current = true;
    try {
      const res = await client.putSrs(delta);
      setStore((s) => afterPush(s, delta, serverItems(res)));
    } catch {
      // Offline or server error – the keys stay dirty and are sent next time.
    } finally {
      pushing.current = false;
    }
  }, [client]);

  // Sign-in (and app start while signed in): pull, merge, and mark what the server lacks.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    client
      .getSrs()
      .then((res) => {
        if (!cancelled) setStore((s) => afterPull(s, serverItems(res)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn, client]);

  // Push whenever there are unsent changes (after record, after a pull, at start).
  useEffect(() => {
    if (signedIn && store.dirty.length > 0) void push();
  }, [signedIn, store.dirty, push]);

  useEffect(() => {
    if (!signedIn) return;
    const onOnline = () => void push();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [signedIn, push]);

  const record = useCallback((answers: ItemAnswer[], mode: AnswerMode) => {
    setStore((s) => applyAnswers(s, answers, mode));
  }, []);

  const reset = useCallback(() => {
    setStore(emptySrs());
    if (signedIn) client.deleteSrs?.().catch(() => undefined);
  }, [signedIn, client]);

  return { store, due: dueCount(store), record, reset };
}
