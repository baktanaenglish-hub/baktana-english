/**
 * Supabase Edge Function: designing a premium pet with AI, for the GitHub Pages site and the Android app
 * (which have no Express server). Same contract and logic as server/src/routes/pet.ts
 * (shared/pet-design.ts); errors are `ApiError` JSON (shared/api.ts).
 *
 *   Headers: `Authorization: Bearer <the user's Supabase access token>` and `apikey: <anon/publishable key>`
 *   POST <SUPABASE_URL>/functions/v1/pet-design  body PetDesignRequest → 200 PetDesignResponse
 *   Errors: 401 unauthorized, 403 premium_required, 429 daily_limit / rate_limited,
 *   400 invalid_design / invalid_json, 502 design_failed, 503 design_unavailable.
 *
 * Premium = the token's email is in the PREMIUM_EMAILS secret, or the learner's paid subscription in
 * public.entitlements is still valid (as in call-turn). Designs per learner per day are capped at
 * PET_DESIGNS_PER_DAY per function instance (best effort; instances are short-lived), on top of the
 * per-IP rate limit.
 *
 * Deploy: `supabase functions deploy pet-design` (uses the same ANTHROPIC_API_KEY and PREMIUM_EMAILS
 * secrets as call-turn). deno.json maps the './call' import of call-safety.ts to its .ts file.
 *
 * The learner's wish is never logged or stored.
 */
import { checkUserMessage } from '../../../shared/call-safety.ts';
import {
  PET_DESIGNS_PER_DAY,
  PET_DESIGN_SCHEMA,
  buildDesignSystemPrompt,
  buildDesignUserMessage,
  parsePetDesign,
  sanitizeDesignRequest,
  type PetDesign,
} from '../../../shared/pet-design.ts';
import { isEntitled, isPremium, parsePremiumEmails, usageDay } from '../../../shared/premium.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-5-5';
const MAX_TOKENS = 400;
const TIMEOUT_MS = 20_000;
const RATE_LIMIT = 20;
const TIME_ZONE = 'Asia/Jerusalem';

const ALLOWED_ORIGINS = new Set(['https://baktanaenglish-hub.github.io', 'https://localhost']);
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly hebrew: string,
  ) {
    super(code);
  }
}

const failed = () => new HttpError(502, 'design_failed', 'העיצוב לא הצליח הפעם. נסו שוב בעוד רגע.');
const unavailable = () => new HttpError(503, 'design_unavailable', 'עיצוב עם AI לא זמין כרגע');
const unauthorized = () => new HttpError(401, 'unauthorized', 'יש להתחבר כדי להמשיך');
const premiumRequired = () => new HttpError(403, 'premium_required', 'עיצוב חיה ייחודית זמין למנויי פרימיום');
const dailyLimit = () =>
  new HttpError(429, 'daily_limit', `הגעתם ל־${PET_DESIGNS_PER_DAY} עיצובים היום. נמשיך מחר! 🌙`);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

/** Designs today per learner (this instance only). */
const designs = new Map<string, number>();

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

function serviceHeaders(serviceKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

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
    throw failed();
  }
  if (res.status === 401 || res.status === 403) throw unauthorized();
  if (!res.ok) throw failed();
  const user = (await res.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
  if (!user || typeof user.id !== 'string' || !user.id) throw unauthorized();
  return { id: user.id, email: typeof user.email === 'string' ? user.email : null };
}

async function isPremiumUser(user: SignedInUser): Promise<boolean> {
  if (isPremium(user.email, parsePremiumEmails(Deno.env.get('PREMIUM_EMAILS')))) return true;
  const { url, serviceKey } = supabaseEnv();
  const query = `select=premium_until&user_id=eq.${encodeURIComponent(user.id)}`;
  const res = await fetch(`${url}/rest/v1/entitlements?${query}`, { headers: serviceHeaders(serviceKey) }).catch(
    () => null,
  );
  if (!res?.ok) throw failed();
  const rows = (await res.json().catch(() => null)) as { premium_until?: string | null }[] | null;
  return isEntitled(rows?.[0]?.premium_until);
}

async function design(body: unknown): Promise<PetDesign> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw unavailable();
  const req = sanitizeDesignRequest(body);
  if (!req) throw new HttpError(400, 'invalid_design', 'תארו את החיה שאתם רוצים');
  if (checkUserMessage(req.prompt).flagged)
    throw new HttpError(400, 'invalid_design', 'נסו לתאר את החיה במילים אחרות 🙂');
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: Deno.env.get('CALL_MODEL') || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: PET_DESIGN_SCHEMA } },
        system: buildDesignSystemPrompt(),
        messages: [{ role: 'user', content: buildDesignUserMessage(req) }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw failed();
  }
  if (!res.ok) {
    console.warn(`[pet-design] upstream status ${res.status}`);
    throw failed();
  }
  const data = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  } | null;
  if (!data || !Array.isArray(data.content) || data.stop_reason === 'refusal') throw failed();
  const text = data.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw failed();
  }
  const result = parsePetDesign(parsed);
  if (!result || checkUserMessage(`${result.name} ${result.bio}`).flagged) throw failed();
  return result;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('origin'));
  const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...extra, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed', message: 'הבקשה אינה תקינה' });

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
    if (!(await isPremiumUser(user))) throw premiumRequired();
    const key = `${user.id}:${usageDay(Date.now(), TIME_ZONE)}`;
    const used = designs.get(key) ?? 0;
    if (used >= PET_DESIGNS_PER_DAY) throw dailyLimit();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'invalid_json', message: 'הבקשה אינה תקינה' });
    }
    const result = await design(body);
    if (designs.size > 10_000) designs.clear();
    designs.set(key, used + 1);
    return json(200, result);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.hebrew });
    console.error('[pet-design] unexpected error');
    return json(500, { error: 'internal', message: 'אירעה שגיאה בשרת, נסו שוב מאוחר יותר' });
  }
});
