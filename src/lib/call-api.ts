import type { ApiError } from '../../shared/api';
import {
  CALL_LIMITS,
  type CallStatusResponse,
  type CallTurnRequest,
  type CallTurnResponse,
  type Correction,
} from '../../shared/call';
import { parsePetDesign, type PetDesign, type PetDesignRequest } from '../../shared/pet-design';
import { loadAuth } from './api';
import { ApiRequestError } from './api-error';
import { ACCOUNTS_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL, USE_SUPABASE } from './config';

/**
 * Client for AI calls (shared/call.ts): POST /api/call/turn and GET /api/call/status on the
 * Express server, or the `call-turn` Edge Function in Supabase builds. Calls need a signed-in
 * (premium) learner, so every request carries the learner's token.
 */

/** Calls need a backend: the Express server or Supabase. A static build without either has none. */
export const CALLS_ENABLED = USE_SUPABASE || ACCOUNTS_ENABLED;

/**
 * Calls are still in development: the tab shows a lock and does not open until the feature is
 * tested. Builds with VITE_CALLS_UNLOCKED=true (the e2e tests) open it.
 */
export const CALLS_LOCKED = import.meta.env.VITE_CALLS_UNLOCKED !== 'true';

/** The model can take a while to answer. */
const TURN_TIMEOUT_MS = 25_000;
const STATUS_TIMEOUT_MS = 10_000;

export const CALL_OFFLINE_MESSAGE = 'אין חיבור לשרת כרגע. בדקו את החיבור לאינטרנט ונסו שוב.';
export const CALL_TIMEOUT_MESSAGE = 'התשובה מתעכבת. נסו שוב בעוד רגע.';
export const CALL_SIGNED_OUT_MESSAGE = 'צריך להתחבר כדי לדבר עם הדמויות.';
export const CALL_PREMIUM_MESSAGE = 'שיחות וידאו זמינות למנויי פרימיום.';
export const CALL_LIMIT_MESSAGE = `הגעתם ל־${CALL_LIMITS.callsPerDay} שיחות היום. נתראה מחר! 🌙`;
const GENERIC_MESSAGE = 'משהו השתבש בשיחה. נסו שוב בעוד רגע.';

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && typeof (body as ApiError).message === 'string';
}

function isCorrection(c: unknown): c is Correction {
  const x = c as Correction;
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof x.original === 'string' &&
    typeof x.corrected === 'string' &&
    typeof x.explanationHe === 'string'
  );
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Checks the response shape, filling in optional parts; null when it is not a turn response. */
export function parseTurnResponse(data: unknown): CallTurnResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<CallTurnResponse>;
  if (typeof d.reply !== 'string' || !d.reply.trim()) return null;
  const res: CallTurnResponse = {
    reply: d.reply,
    replyHe: typeof d.replyHe === 'string' ? d.replyHe : '',
    corrections: Array.isArray(d.corrections) ? d.corrections.filter(isCorrection) : [],
  };
  if (d.flagged === 'inappropriate' || d.flagged === 'personal_info' || d.flagged === 'self_harm') {
    res.flagged = d.flagged;
  }
  if (d.ended === true) res.ended = true;
  if (isCount(d.callsToday)) res.callsToday = Math.floor(d.callsToday);
  return res;
}

/** Checks a status response; null when it is not one. `callsPerDay` defaults to CALL_LIMITS. */
export function parseStatusResponse(data: unknown): CallStatusResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Partial<CallStatusResponse>;
  if (typeof d.premium !== 'boolean') return null;
  const res: CallStatusResponse = {
    premium: d.premium,
    callsToday: isCount(d.callsToday) ? Math.floor(d.callsToday) : 0,
    callsPerDay: isCount(d.callsPerDay) && d.callsPerDay > 0 ? Math.floor(d.callsPerDay) : CALL_LIMITS.callsPerDay,
  };
  if (typeof d.premiumUntil === 'string' && Number.isFinite(Date.parse(d.premiumUntil))) {
    res.premiumUntil = d.premiumUntil;
  }
  if (typeof d.willRenew === 'boolean') res.willRenew = d.willRenew;
  if (d.tester === true && !d.premium) res.tester = true;
  return res;
}

const signedOut = () => new ApiRequestError(401, 'unauthorized', CALL_SIGNED_OUT_MESSAGE);

/** The signed-in learner's access token from the Supabase session (refreshed by supabase-js). */
async function supabaseToken(): Promise<string | null> {
  try {
    const { getSupabase } = await import('./supabase');
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    throw new ApiRequestError(0, 'network', CALL_OFFLINE_MESSAGE);
  }
}

type Path = 'turn' | 'status' | 'pet-design';

/** URL and headers for a call request; throws a 401 ApiRequestError when nobody is signed in. */
async function endpoint(path: Path): Promise<{ url: string; headers: Record<string, string> }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (USE_SUPABASE) {
    const token = await supabaseToken();
    if (!token) throw signedOut();
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${token}`;
    // One function serves both call requests: POST is a turn, GET the status.
    const fn = path === 'pet-design' ? 'pet-design' : 'call-turn';
    return { url: `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${fn}`, headers };
  }
  const token = loadAuth()?.token;
  if (!token) throw signedOut();
  headers.Authorization = `Bearer ${token}`;
  return { url: path === 'pet-design' ? '/api/pet/design' : `/api/call/${path}`, headers };
}

/** The error for a non-OK response: the server's Hebrew message when it sent one. */
function httpError(status: number, data: unknown): ApiRequestError {
  const body = isApiError(data) ? data : null;
  if (status === 401) return new ApiRequestError(401, 'unauthorized', body?.message || CALL_SIGNED_OUT_MESSAGE);
  if (status === 403) return new ApiRequestError(403, 'premium_required', body?.message || CALL_PREMIUM_MESSAGE);
  if (status === 429 && body?.error === 'daily_limit') {
    return new ApiRequestError(429, 'daily_limit', body.message || CALL_LIMIT_MESSAGE);
  }
  if (body) return new ApiRequestError(status, body.error, body.message);
  // A proxy/gateway failure without our JSON body means the API is unreachable.
  const unreachable = status >= 500 || status === 404;
  return new ApiRequestError(unreachable ? 0 : status, 'http', unreachable ? CALL_OFFLINE_MESSAGE : GENERIC_MESSAGE);
}

async function call(
  path: Path,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number; signal?: AbortSignal },
): Promise<unknown> {
  const { url, headers } = await endpoint(path);
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const { signal } = init;
  const timeout =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(init.timeoutMs) : undefined;
  const signals = [timeout, signal].filter((s): s is AbortSignal => s !== undefined);
  const combined = signals.length > 1 && 'any' in AbortSignal ? AbortSignal.any(signals) : signals[0];

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: combined,
    });
  } catch (e) {
    if (signal?.aborted) throw new ApiRequestError(0, 'aborted', GENERIC_MESSAGE);
    const timedOut = timeout?.aborted || (e instanceof Error && e.name === 'TimeoutError');
    throw timedOut
      ? new ApiRequestError(0, 'timeout', CALL_TIMEOUT_MESSAGE)
      : new ApiRequestError(0, 'network', CALL_OFFLINE_MESSAGE);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON – e.g. the dev proxy's error page when no server is running.
  }
  if (!res.ok) throw httpError(res.status, data);
  return data;
}

/** Sends what the learner said and returns the character's reply. Throws ApiRequestError (Hebrew message). */
export async function sendTurn(req: CallTurnRequest, signal?: AbortSignal): Promise<CallTurnResponse> {
  const data = await call('turn', { method: 'POST', body: req, timeoutMs: TURN_TIMEOUT_MS, signal });
  const parsed = parseTurnResponse(data);
  if (!parsed) throw new ApiRequestError(0, 'bad-response', GENERIC_MESSAGE);
  return parsed;
}

/** Whether the signed-in learner can call, and today's usage. Throws ApiRequestError (401 when signed out). */
export async function getCallStatus(signal?: AbortSignal): Promise<CallStatusResponse> {
  const data = await call('status', { method: 'GET', timeoutMs: STATUS_TIMEOUT_MS, signal });
  const parsed = parseStatusResponse(data);
  if (!parsed) throw new ApiRequestError(0, 'bad-response', CALL_OFFLINE_MESSAGE);
  return parsed;
}

/** Whether a failed turn means the learner can't call any more (signed out, not premium, daily limit). */
export function isCallBlocked(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403 || (error.status === 429 && error.code === 'daily_limit'))
  );
}

/** Designs a premium pet with AI (shared/pet-design.ts). Throws ApiRequestError (Hebrew message). */
export async function designPet(req: PetDesignRequest, signal?: AbortSignal): Promise<PetDesign> {
  const data = await call('pet-design', { method: 'POST', body: req, timeoutMs: TURN_TIMEOUT_MS, signal });
  const parsed = parsePetDesign(data);
  if (!parsed) throw new ApiRequestError(0, 'bad-response', 'העיצוב לא הצליח הפעם. נסו שוב בעוד רגע.');
  return parsed;
}
