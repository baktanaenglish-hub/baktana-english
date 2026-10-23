/**
 * Head-to-head duels: two friends race for the most XP over DUEL_DAYS days. One learner opens a duel
 * and sends the invite code (or link); the first friend to accept it starts the clock. Pure rules
 * shared by the Express server, the Supabase client (src/lib/cloud.ts) and the web app.
 *
 * Points are the app's existing XP (xp_events), counted from the moment the duel starts until it ends,
 * so XP from before the duel never counts.
 */
import type { PetBadge } from './pet-design';

export const DUEL_DAYS = 7;
export const DUEL_MS = DUEL_DAYS * 24 * 60 * 60 * 1000;
/** An invite nobody accepted stops working after this long. */
export const DUEL_INVITE_MS = DUEL_MS;
/** A finished duel stays on the list this long, so its prize can still be collected. */
export const DUEL_SHOWN_AFTER_END_MS = 14 * 24 * 60 * 60 * 1000;
/** Open invites plus running duels per learner. */
export const MAX_OPEN_DUELS = 3;

/** Gems for the result, collected once on the device (like group challenges). */
export const DUEL_PRIZES = { won: 30, tie: 15, lost: 5 } as const;

export type DuelResult = keyof typeof DUEL_PRIZES;
/** waiting: no friend accepted yet; active: the clock runs; finished: there is a result. */
export type DuelState = 'waiting' | 'active' | 'finished';

export interface DuelSide {
  displayName: string;
  /** XP since the duel started (0 while waiting). */
  xp: number;
  pet?: PetBadge | null;
}

/** A duel as a backend stores it, seen by one of its two learners. */
export interface DuelRecord {
  id: string;
  inviteCode: string;
  /** The caller opened it. */
  isChallenger: boolean;
  createdAt: number;
  /** When a friend accepted it (ms), or null while waiting. */
  startsAt: number | null;
  me: DuelSide;
  opponent: DuelSide | null;
}

export interface DuelSummary extends DuelRecord {
  state: DuelState;
  /** When the duel ends (ms), or – while waiting – when the invite expires. */
  endsAt: number;
  /** Set once finished. */
  result: DuelResult | null;
}

/** GET /api/duels (auth) – the learner's open, running and recently finished duels, newest first. */
export interface DuelsResponse {
  duels: DuelSummary[];
}

/** POST /api/duels (auth, no body) → 201, and POST /api/duels/join { code } → 200. */
export interface DuelResponse {
  duel: DuelSummary;
}

export interface JoinDuelRequest {
  code: string;
}

export function duelResult(me: number, opponent: number): DuelResult {
  return me > opponent ? 'won' : me < opponent ? 'lost' : 'tie';
}

/** Whether the duel still belongs on the learner's list at `now`. */
export function duelVisible(r: DuelRecord, now = Date.now()): boolean {
  if (r.startsAt === null) return now < r.createdAt + DUEL_INVITE_MS;
  return now < r.startsAt + DUEL_MS + DUEL_SHOWN_AFTER_END_MS;
}

/** Whether the duel counts toward MAX_OPEN_DUELS: an invite still open, or a duel still running. */
export function duelOpen(r: { createdAt: number; startsAt: number | null }, now = Date.now()): boolean {
  return r.startsAt === null ? now < r.createdAt + DUEL_INVITE_MS : now < r.startsAt + DUEL_MS;
}

export function summarizeDuel(r: DuelRecord, now = Date.now()): DuelSummary {
  if (r.startsAt === null) {
    return { ...r, state: 'waiting', endsAt: r.createdAt + DUEL_INVITE_MS, result: null };
  }
  const endsAt = r.startsAt + DUEL_MS;
  const finished = now >= endsAt;
  return {
    ...r,
    state: finished ? 'finished' : 'active',
    endsAt,
    result: finished ? duelResult(r.me.xp, r.opponent?.xp ?? 0) : null,
  };
}

/** The list GET /api/duels returns: visible duels, newest first. */
export function summarizeDuels(records: DuelRecord[], now = Date.now()): DuelSummary[] {
  return records
    .filter((r) => duelVisible(r, now))
    .sort((a, b) => (b.startsAt ?? b.createdAt) - (a.startsAt ?? a.createdAt))
    .map((r) => summarizeDuel(r, now));
}

/** The link sent to a friend: the app's address with `?duel=CODE`. */
export function duelLink(base: string, code: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('duel', code);
  return url.href;
}

/** Hebrew messages for the duel errors both backends report. */
export const DUEL_ERRORS = {
  invalid_code: 'קוד התחרות לא תקין. בדקו אותו ונסו שוב.',
  duel_not_found: 'לא מצאנו תחרות פתוחה עם הקוד הזה. אולי היא כבר התחילה או שפג תוקפה.',
  own_duel: 'זו התחרות שלכם – שלחו את הקוד לחבר או לחברה',
  too_many_duels: `אפשר לנהל עד ${MAX_OPEN_DUELS} תחרויות בבת אחת`,
  not_in_duel: 'התחרות הזאת לא נמצאה',
} as const;

export type DuelErrorCode = keyof typeof DUEL_ERRORS;

export const DUEL_STATUS: Record<DuelErrorCode, number> = {
  invalid_code: 400,
  duel_not_found: 404,
  own_duel: 409,
  too_many_duels: 409,
  not_in_duel: 404,
};
