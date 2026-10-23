/**
 * The learner's side of head-to-head duels (shared/duels.ts): the list from the backend, the prize of
 * each finished duel, collected once on this device (like group challenges), and notices – "a friend
 * accepted your invite" – from comparing each fresh list with the last one seen here. The Android app
 * also shows the notices as system notifications.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useCallback, useEffect, useState } from 'react';
import { DUEL_DAYS, DUEL_PRIZES, type DuelResult, type DuelState, type DuelSummary } from '../../shared/duels';
import { api, errorMessage } from './api';

export const DUELS_KEY = 'baktana-english:duels:v1';
/** Notices kept in the feed. */
export const MAX_DUEL_NOTICES = 20;

export interface DuelNotice {
  id: string;
  duelId: string;
  icon: string;
  text: string;
  at: number;
}

export interface DuelsLocal {
  /** Finished duels whose prize was collected. */
  claimed: string[];
  /** Each duel's state when the list was last seen on this device. */
  seen: Record<string, DuelState>;
  notices: DuelNotice[];
  /** Notices up to this time have been seen. */
  readAt: number;
}

export function initialDuelsLocal(): DuelsLocal {
  return { claimed: [], seen: {}, notices: [], readAt: 0 };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function parseDuelsLocal(raw: string | null): DuelsLocal {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    // The first version stored only the list of collected prizes.
    if (Array.isArray(v)) return { ...initialDuelsLocal(), claimed: strings(v) };
    if (!v || typeof v !== 'object') return initialDuelsLocal();
    const d = v as Partial<DuelsLocal>;
    return {
      claimed: strings(d.claimed),
      seen: d.seen && typeof d.seen === 'object' ? d.seen : {},
      notices: Array.isArray(d.notices) ? d.notices.slice(0, MAX_DUEL_NOTICES) : [],
      readAt: typeof d.readAt === 'number' ? d.readAt : 0,
    };
  } catch {
    return initialDuelsLocal();
  }
}

/** Each learner signed in on the device keeps their own prizes and notices. */
const storageKey = (userId: string) => `${DUELS_KEY}:${userId}`;

export function loadDuelsLocal(userId: string): DuelsLocal {
  try {
    return parseDuelsLocal(localStorage.getItem(storageKey(userId)));
  } catch {
    return initialDuelsLocal();
  }
}

function saveDuelsLocal(userId: string, state: DuelsLocal) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Storage unavailable – prizes and notices just show again.
  }
}

/**
 * What changed since the duels were last seen: an invite of the learner that a friend accepted. A duel
 * seen for the first time gives no notice (it may have been opened on another device long ago).
 */
export function duelNotices(seen: Record<string, DuelState>, duels: DuelSummary[], now = Date.now()): DuelNotice[] {
  return duels
    .filter((d) => d.isChallenger && seen[d.id] === 'waiting' && d.state !== 'waiting' && d.opponent)
    .map((d) => ({
      id: `${d.id}|accepted`,
      duelId: d.id,
      icon: '⚔️',
      text: `${d.opponent!.displayName} קיבל/ה את ההזמנה שלכם – התחרות התחילה! ${DUEL_DAYS} ימים, מי יצבור יותר XP?`,
      at: now,
    }));
}

/** Applies a fresh list: new notices first, the seen states replaced, prizes of gone duels forgotten. */
export function applyDuels(
  state: DuelsLocal,
  duels: DuelSummary[],
  now = Date.now(),
): { state: DuelsLocal; fresh: DuelNotice[] } {
  const known = new Set(state.notices.map((n) => n.id));
  const fresh = duelNotices(state.seen, duels, now).filter((n) => !known.has(n.id));
  const ids = new Set(duels.map((d) => d.id));
  return {
    state: {
      ...state,
      seen: Object.fromEntries(duels.map((d) => [d.id, d.state])),
      notices: [...fresh, ...state.notices.filter((n) => ids.has(n.duelId))].slice(0, MAX_DUEL_NOTICES),
      claimed: state.claimed.filter((id) => ids.has(id)),
    },
    fresh,
  };
}

/** At most one refresh per this long when the app comes back to the foreground. */
const REFRESH_GAP_MS = 60_000;

const NOTICE_FIRST_ID = 3001;
const NOTICE_SLOTS = 20;

/** Android: shows fresh notices as system notifications (the web shows them in the app only). */
export async function notifyDuelNotices(notices: DuelNotice[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || notices.length === 0) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    const at = new Date(Date.now() + 1000);
    await LocalNotifications.schedule({
      notifications: notices.slice(0, 3).map((n, i) => ({
        id: NOTICE_FIRST_ID + ((Math.floor(n.at / 1000) + i) % NOTICE_SLOTS),
        title: `${n.icon} ראש בראש`,
        body: n.text,
        schedule: { at, allowWhileIdle: true },
        smallIcon: 'ic_stat_notify',
      })),
    });
  } catch {
    // Notifications unavailable – the notices are still in the app.
  }
}

/** Finished duels whose prize wasn't collected yet. */
export function unclaimedDuels(duels: DuelSummary[] | null, claimed: string[]): DuelSummary[] {
  return (duels ?? []).filter((d) => d.state === 'finished' && !claimed.includes(d.id));
}

/** "Ends in …" for a duel: hours in the last day, days before. */
export function timeLeftText(endsAt: number, now = Date.now()): string {
  const hours = Math.max(0, Math.ceil((endsAt - now) / 3_600_000));
  if (hours <= 24) return hours <= 1 ? 'פחות משעה' : `${hours} שעות`;
  const days = Math.ceil(hours / 24);
  return days === 2 ? 'יומיים' : `${days} ימים`;
}

export interface DuelsState {
  /** null until the first answer (or while signed out). */
  duels: DuelSummary[] | null;
  error: string | null;
  claimed: string[];
  notices: DuelNotice[];
  /** Notices newer than this were already seen. */
  readAt: number;
  /** Finished duels with a prize waiting. */
  unclaimed: number;
  /** Notices not seen yet. */
  unread: number;
  refresh: () => Promise<void>;
  markRead: () => void;
  /** Collects a finished duel's prize once; null when there is nothing to collect. */
  claim: (duelId: string) => { result: DuelResult; gems: number } | null;
}

/** The signed-in learner's duels, loaded on sign-in and whenever `refresh` is called. */
export function useDuels(userId: string | null): DuelsState {
  const [duels, setDuels] = useState<DuelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<DuelsLocal>(initialDuelsLocal);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.duels();
      const applied = applyDuels(loadDuelsLocal(userId), res.duels);
      saveDuelsLocal(userId, applied.state);
      setLocal(applied.state);
      setDuels(res.duels);
      setError(null);
      void notifyDuelNotices(applied.fresh);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [userId]);

  useEffect(() => {
    setDuels(null);
    setError(null);
    setLocal(userId ? loadDuelsLocal(userId) : initialDuelsLocal());
    void refresh();
  }, [userId, refresh]);

  // Coming back to the app (or the tab) is when a learner wonders whether their friend accepted.
  useEffect(() => {
    if (!userId || typeof document === 'undefined') return;
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < REFRESH_GAP_MS) return;
      last = Date.now();
      void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refresh]);

  const markRead = useCallback(() => {
    if (!userId) return;
    setLocal((s) => {
      const next = { ...s, readAt: Date.now() };
      saveDuelsLocal(userId, next);
      return next;
    });
  }, [userId]);

  const claim = useCallback(
    (duelId: string) => {
      const duel = duels?.find((d) => d.id === duelId);
      if (!userId || !duel?.result || local.claimed.includes(duelId)) return null;
      const next = { ...local, claimed: [...local.claimed, duelId] };
      saveDuelsLocal(userId, next);
      setLocal(next);
      return { result: duel.result, gems: DUEL_PRIZES[duel.result] };
    },
    [userId, duels, local],
  );

  return {
    duels,
    error,
    claimed: local.claimed,
    notices: local.notices,
    readAt: local.readAt,
    unclaimed: unclaimedDuels(duels, local.claimed).length,
    unread: local.notices.filter((n) => n.at > local.readAt).length,
    refresh,
    markRead,
    claim,
  };
}

/** Reads `?duel=CODE` from the address (a shared duel link) and removes it from the address bar. */
export function takeDuelCode(): string | null {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('duel');
    if (!code) return null;
    url.searchParams.delete('duel');
    window.history.replaceState(window.history.state, '', url.href);
    return code;
  } catch {
    return null;
  }
}
