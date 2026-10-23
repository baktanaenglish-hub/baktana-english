/**
 * Supabase Edge Function: the AI video call, for the GitHub Pages site and the Android app (which
 * have no Express server). Same contract and logic as server/src/routes/call.ts (shared/call.ts),
 * errors are `ApiError` JSON (shared/api.ts).
 *
 * Client contract – both need a signed-in learner:
 *   Headers: `Authorization: Bearer <the user's Supabase access token>` and `apikey: <anon/publishable key>`
 *   (supabase.functions.invoke sends both when a session exists).
 *   POST <SUPABASE_URL>/functions/v1/call-turn  body CallTurnRequest → 200 CallTurnResponse (with callsToday)
 *   GET  <SUPABASE_URL>/functions/v1/call-turn  (no body)            → 200 CallStatusResponse
 *   Errors: 401 unauthorized, 403 premium_required (POST only; GET answers premium: false),
 *   429 daily_limit / rate_limited, 400 invalid_call / invalid_json, 502 call_failed, 503 call_unavailable.
 *
 * Premium = the token's email is in the PREMIUM_EMAILS secret (comma-separated), or the learner's paid
 * subscription in public.entitlements (written by the billing-webhook function) is still valid.
 * Testers (TESTER_EMAILS secret) who aren't premium get a short daily trial (shared/call.ts TESTER_LIMITS);
 * the status says `tester: true` and their callsPerDay. Usage is counted per
 * learner and Asia/Jerusalem day in public.call_usage through public.increment_call_usage (schema.sql),
 * called with the auto-provided SUPABASE_SERVICE_ROLE_KEY. A valid turn is counted before the model call
 * (flagged and goodbye turns too; a 502 is not refunded); invalid requests and 503s are not counted.
 *
 * Deploy: `supabase functions deploy call-turn`, `supabase secrets set ANTHROPIC_API_KEY=... PREMIUM_EMAILS=...`
 * (docs/supabase.md). The shared modules import './call' without an extension; deno.json next to this
 * file maps that specifier to '../../../shared/call.ts' so Deno resolves it.
 *
 * Message content is never logged or stored.
 */
import { callsLimitMessage, findPersona, limitsFor } from '../../../shared/call.ts';
import type { CallMessage, CallStatusResponse, CallTurnResponse } from '../../../shared/call.ts';
import { buildSystemPrompt, parseModelOutput } from '../../../shared/call-prompts.ts';
import { checkModelReply, checkUserMessage, safeReply, sanitizeTurnRequest } from '../../../shared/call-safety.ts';
import { isEntitled, isNewCall, isPremium, parsePremiumEmails, usageDay } from '../../../shared/premium.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_CALL_MODEL = 'claude-haiku-5-5';
/** Room for the reply, its Hebrew translation and up to three corrections (truncated JSON is unusable). */
const MAX_TOKENS = 800;
const TIMEOUT_MS = 20_000;
const CALL_START = '(The call starts.)';
/** Requests per minute per IP, per function instance (best effort; instances are short-lived). */
const RATE_LIMIT = 30;
/** Usage days follow Israel time, like the Express server (TZ=Asia/Jerusalem). */
const TIME_ZONE = 'Asia/Jerusalem';

/**
 * Structured outputs (output_config.format): the model must answer with exactly this JSON shape, even though
 * the history it sees has plain-text assistant turns. parseModelOutput still validates and caps the fields.
 */
export const CALL_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    replyHe: { type: 'string' },
    corrections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          corrected: { type: 'string' },
          explanationHe: { type: 'string' },
        },
        required: ['original', 'corrected', 'explanationHe'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'replyHe', 'corrections'],
  additionalProperties: false,
} as const;

const ALLOWED_ORIGINS = new Set(['https://baktanaenglish-hub.github.io', 'https://localhost']);
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const FALLBACK = { reply: 'Sorry, could you say that again?', replyHe: 'סליחה, אפשר לחזור על זה?' };
const GOODBYE = {
  reply: "It was so nice talking with you! We're out of time for this call. Bye for now!",
  replyHe: 'היה ממש כיף לדבר איתך! נגמר לנו הזמן לשיחה הזאת. ביי בינתיים!',
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly hebrew: string,
  ) {
    super(code);
  }
}

const failed = () => new HttpError(502, 'call_failed', 'השיחה נתקעה לרגע, נסו לומר את זה שוב');
const unavailable = () => new HttpError(503, 'call_unavailable', 'שיחות הווידאו לא זמינות כרגע');
const unauthorized = () => new HttpError(401, 'unauthorized', 'יש להתחבר כדי להמשיך');
const premiumRequired = () => new HttpError(403, 'premium_required', 'שיחות וידאו זמינות רק למנויי פרימיום');
const callsLimit = (perDay: number) => new HttpError(429, 'daily_limit', callsLimitMessage(perDay));
const turnsLimit = () => new HttpError(429, 'daily_limit', 'הגעתם למגבלת השיחות להיום. נתראה מחר!');

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && (ALLOWED_ORIGINS.has(origin) || DEV_ORIGIN.test(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  let entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 10_000) hits.clear();
    entry = { count: 0, resetAt: now + 60_000 };
    hits.set(ip, entry);
  }
  return ++entry.count > RATE_LIMIT;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Starts with `user` and alternates, as the Messages API requires. */
function toAnthropicMessages(history: CallMessage[], message: string): AnthropicMessage[] {
  const all: CallMessage[] = [...history, { role: 'user', text: message }];
  const out: AnthropicMessage[] = [];
  if (all[0].role !== 'user') out.push({ role: 'user', content: CALL_START });
  for (const m of all) {
    const last = out.at(-1);
    if (last?.role === m.role) last.content += `\n${m.text}`;
    else out.push({ role: m.role, content: m.text });
  }
  return out;
}

interface SignedInUser {
  id: string;
  email: string | null;
}

function supabaseEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw unavailable();
  return { url: url.replace(/\/+$/, ''), serviceKey, anonKey: Deno.env.get('SUPABASE_ANON_KEY') || serviceKey };
}

/** Headers for a service-role request. New `sb_secret_…` keys are not JWTs and go in `apikey` only. */
function serviceHeaders(serviceKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

/** The learner behind `Authorization: Bearer <access token>`, verified by Supabase Auth; else 401. */
async function signedInUser(request: Request): Promise<SignedInUser> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw unauthorized();
  const { url, anonKey } = supabaseEnv();
  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.warn('[call-turn] auth request failed');
    throw failed();
  }
  if (res.status === 401 || res.status === 403) throw unauthorized();
  if (!res.ok) {
    console.warn(`[call-turn] auth status ${res.status}`);
    throw failed();
  }
  const user = (await res.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
  if (!user || typeof user.id !== 'string' || !user.id) throw unauthorized();
  return { id: user.id, email: typeof user.email === 'string' ? user.email : null };
}

const premiumEmails = () => parsePremiumEmails(Deno.env.get('PREMIUM_EMAILS'));
/** Testers get a short daily trial call (TESTER_LIMITS) before premium is sold. */
const testerEmails = () => parsePremiumEmails(Deno.env.get('TESTER_EMAILS'));

interface Premium {
  premium: boolean;
  /** Not premium, but on the TESTER_EMAILS list. */
  tester?: boolean;
  /** Set when the learner has (or had) a subscription. */
  premiumUntil?: string;
  willRenew?: boolean;
}

/** Whether the learner is premium: on the PREMIUM_EMAILS allowlist, or with a valid subscription. */
async function premiumOf(user: SignedInUser): Promise<Premium> {
  const listed = isPremium(user.email, premiumEmails());
  const { url, serviceKey } = supabaseEnv();
  const query = `select=premium_until,will_renew&user_id=eq.${encodeURIComponent(user.id)}`;
  const res = await fetch(`${url}/rest/v1/entitlements?${query}`, { headers: serviceHeaders(serviceKey) }).catch(
    () => null,
  );
  if (!res?.ok) {
    console.warn(`[call-turn] entitlement read failed${res ? ` (${res.status})` : ''}`);
    // The allowlist alone still decides; without it, a failed read is not a "no".
    if (listed) return { premium: true };
    throw failed();
  }
  const rows = (await res.json().catch(() => null)) as
    { premium_until?: string | null; will_renew?: boolean | null }[] | null;
  const row = rows?.[0];
  const result: Premium = { premium: listed || isEntitled(row?.premium_until) };
  if (!result.premium && isPremium(user.email, testerEmails())) result.tester = true;
  if (row?.premium_until) result.premiumUntil = new Date(row.premium_until).toISOString();
  if (typeof row?.will_renew === 'boolean') result.willRenew = row.will_renew;
  return result;
}

/** Today's calls for the learner (0 without a row). */
async function callsToday(userId: string): Promise<number> {
  const { url, serviceKey } = supabaseEnv();
  const query = `select=calls&user_id=eq.${encodeURIComponent(userId)}&day=eq.${usageDay(Date.now(), TIME_ZONE)}`;
  const res = await fetch(`${url}/rest/v1/call_usage?${query}`, { headers: serviceHeaders(serviceKey) }).catch(
    () => null,
  );
  if (!res?.ok) {
    console.warn(`[call-turn] usage read failed${res ? ` (${res.status})` : ''}`);
    throw failed();
  }
  const rows = (await res.json().catch(() => null)) as { calls?: number }[] | null;
  return Number(rows?.[0]?.calls ?? 0);
}

/** Checks the daily limits and counts the turn atomically (public.increment_call_usage); returns today's calls. */
async function chargeTurn(userId: string, newCall: boolean, limits: Limits): Promise<number> {
  const { url, serviceKey } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/rpc/increment_call_usage`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey),
    body: JSON.stringify({
      p_user: userId,
      p_day: usageDay(Date.now(), TIME_ZONE),
      p_new_call: newCall,
      p_calls_limit: limits.callsPerDay,
      p_turns_limit: limits.turnsPerDay,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    console.warn(`[call-turn] usage update failed${res ? ` (${res.status})` : ''}`);
    throw failed();
  }
  const result = (await res.json().catch(() => null)) as { allowed?: boolean; reason?: string; calls?: number } | null;
  if (!result || typeof result.allowed !== 'boolean') throw failed();
  if (!result.allowed) throw result.reason === 'calls' ? callsLimit(limits.callsPerDay) : turnsLimit();
  return Number(result.calls ?? 0);
}

async function callModel(apiKey: string, system: string, messages: AnthropicMessage[]): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: Deno.env.get('CALL_MODEL') || DEFAULT_CALL_MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: CALL_OUTPUT_SCHEMA } },
        system,
        messages,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[call-turn] upstream request failed: ${(err as Error)?.name ?? 'error'}`);
    throw failed();
  }
  if (!res.ok) {
    console.warn(`[call-turn] upstream status ${res.status}`);
    throw failed();
  }
  const data = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  } | null;
  if (!data || !Array.isArray(data.content)) throw failed();
  if (data.stop_reason === 'refusal') return null;
  return data.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
}

type Limits = ReturnType<typeof limitsFor>;

async function callTurn(body: unknown, user: SignedInUser, limits: Limits): Promise<CallTurnResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw unavailable();
  supabaseEnv(); // 503 before counting anything when the service key is missing
  const req = sanitizeTurnRequest(body);
  const persona = req && findPersona(req.persona);
  if (!req || !persona) throw new HttpError(400, 'invalid_call', 'הבקשה לשיחה אינה תקינה');

  const rawHistory = (body as { history?: unknown }).history;
  const callsToday = await chargeTurn(user.id, isNewCall(rawHistory), limits);

  const learnerTurns = Array.isArray(rawHistory)
    ? rawHistory.filter((m) => (m as { role?: unknown })?.role === 'user').length
    : 0;
  if (learnerTurns >= limits.maxTurns) return { ...GOODBYE, corrections: [], ended: true, callsToday };

  const check = checkUserMessage(req.message);
  if (check.flagged) {
    return { ...safeReply(check.flagged, persona), corrections: [], flagged: check.flagged, callsToday };
  }

  const raw = await callModel(
    apiKey,
    buildSystemPrompt(persona, req.pace),
    toAnthropicMessages(req.history, req.message),
  );
  if (raw === null) return { ...safeReply('inappropriate', persona), corrections: [], callsToday };
  const parsed = parseModelOutput(raw, persona);
  if (!parsed) return { ...FALLBACK, corrections: [], callsToday };
  if (!checkModelReply(parsed.reply)) return { ...safeReply('inappropriate', persona), corrections: [], callsToday };
  return {
    reply: parsed.reply,
    replyHe: parsed.replyHe,
    corrections: persona.corrects ? parsed.corrections : [],
    callsToday,
  };
}

async function callStatus(user: SignedInUser): Promise<CallStatusResponse> {
  const [premium, calls] = await Promise.all([premiumOf(user), callsToday(user.id)]);
  return { ...premium, callsToday: calls, callsPerDay: limitsFor(premium.tester ? 'tester' : 'premium').callsPerDay };
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('origin'));
  const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...extra, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST' && request.method !== 'GET') {
    return json(405, { error: 'method_not_allowed', message: 'הבקשה אינה תקינה' });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return json(
      429,
      { error: 'rate_limited', message: 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות' },
      { 'Retry-After': '60' },
    );
  }

  try {
    const user = await signedInUser(request);
    if (request.method === 'GET') return json(200, await callStatus(user));
    const access = await premiumOf(user);
    if (!access.premium && !access.tester) throw premiumRequired();
    const limits = limitsFor(access.premium ? 'premium' : 'tester');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'invalid_json', message: 'הבקשה אינה תקינה' });
    }
    return json(200, await callTurn(body, user, limits));
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.hebrew });
    console.error('[call-turn] unexpected error');
    return json(500, { error: 'internal', message: 'אירעה שגיאה בשרת, נסו שוב מאוחר יותר' });
  }
});
