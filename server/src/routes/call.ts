import { Router, type RequestHandler } from 'express';
import {
  CALL_LIMITS,
  callsLimitMessage,
  findPersona,
  limitsFor,
  type CallAccess,
  type CallMessage,
  type CallStatusResponse,
  type CallTurnResponse,
} from '../../../shared/call';
import { buildSystemPrompt, parseModelOutput } from '../../../shared/call-prompts';
import { checkModelReply, checkUserMessage, safeReply, sanitizeTurnRequest } from '../../../shared/call-safety';
import { isNewCall, isPremium, usageDay } from '../../../shared/premium';
import { HttpError, badRequest } from '../errors';
import type { Repo } from '../repo';

/** How the server reaches the Anthropic Messages API. Every field falls back to the environment. */
export interface CallModelOptions {
  /** Defaults to ANTHROPIC_API_KEY. Without a key the call feature answers 503. */
  apiKey?: string;
  /** Defaults to CALL_MODEL, then a fast, low-latency model. */
  model?: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const DEFAULT_CALL_MODEL = 'claude-haiku-5-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/** Room for the reply, its Hebrew translation and up to three corrections (truncated JSON is unusable). */
const MAX_TOKENS = 800;
const TIMEOUT_MS = 20_000;

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

/** Opens the conversation when the history starts with the character's greeting (the API wants `user` first). */
export const CALL_START = '(The call starts.)';

const FALLBACK = { reply: 'Sorry, could you say that again?', replyHe: 'סליחה, אפשר לחזור על זה?' };
const GOODBYE = {
  reply: "It was so nice talking with you! We're out of time for this call. Bye for now!",
  replyHe: 'היה ממש כיף לדבר איתך! נגמר לנו הזמן לשיחה הזאת. ביי בינתיים!',
};

const unavailable = () => new HttpError(503, 'call_unavailable', 'שיחות הווידאו לא זמינות כרגע');
const failed = () => new HttpError(502, 'call_failed', 'השיחה נתקעה לרגע, נסו לומר את זה שוב');
const premiumRequired = () => new HttpError(403, 'premium_required', 'שיחות וידאו זמינות כרגע רק למנויי פרימיום');
const callsLimit = (perDay: number) => new HttpError(429, 'daily_limit', callsLimitMessage(perDay));
const turnsLimit = () => new HttpError(429, 'daily_limit', 'הגעתם למגבלת השיחות להיום. נתראה מחר!');

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The history plus the new message as Anthropic messages: starts with `user` (a stage
 * direction is prepended before the greeting) and alternates (same-role neighbours merged).
 */
export function toAnthropicMessages(history: CallMessage[], message: string): AnthropicMessage[] {
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

/**
 * Learner turns in the raw history. Counted before sanitizeTurnRequest keeps only the last
 * CALL_LIMITS.maxHistory lines, so the limit holds when the client sends the whole call.
 */
export function countLearnerTurns(body: unknown): number {
  const history = (body as { history?: unknown })?.history;
  if (!Array.isArray(history)) return 0;
  return history.filter((m) => (m as { role?: unknown })?.role === 'user').length;
}

/** One Messages API request; returns the reply text, or throws a 502 HttpError. */
async function callModel(options: Required<CallModelOptions>, system: string, messages: AnthropicMessage[]) {
  let res: Response;
  try {
    res = await options.fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: MAX_TOKENS,
        // Short spoken replies: keep thinking minimal for latency.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: CALL_OUTPUT_SCHEMA } },
        system,
        messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (err) {
    // Network error or timeout. Never log the conversation itself.
    console.warn(`[call] upstream request failed: ${(err as Error)?.name ?? 'error'}`);
    throw failed();
  }
  if (!res.ok) {
    console.warn(`[call] upstream status ${res.status}`);
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

/**
 * Counts a validated turn against the daily limits and returns today's call count, or throws a 429.
 * `newCall` is true when the raw history has no learner message (shared/premium.ts isNewCall).
 */
export type ChargeTurn = (newCall: boolean) => number;

/**
 * The full turn logic, independent of Express. Throws HttpError for 429/502/503.
 *
 * `charge` runs once the request is valid and the feature is configured, BEFORE the goodbye, the
 * safety check and the model call: every valid turn counts (flagged and goodbye turns too), and a
 * turn whose model call then fails (502) is not refunded. Invalid requests (400) and 503 never count.
 */
export async function callTurn(
  body: unknown,
  model: CallModelOptions,
  charge?: ChargeTurn,
  maxTurns: number = CALL_LIMITS.maxTurns,
): Promise<CallTurnResponse | null> {
  const apiKey = model.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw unavailable();
  const req = sanitizeTurnRequest(body);
  const persona = req && findPersona(req.persona);
  if (!req || !persona) return null;

  const calls = charge?.(isNewCall((body as { history?: unknown }).history));
  const usage = calls === undefined ? {} : { callsToday: calls };

  if (countLearnerTurns(body) >= maxTurns) return { ...GOODBYE, corrections: [], ended: true, ...usage };

  const check = checkUserMessage(req.message);
  if (check.flagged) {
    return { ...safeReply(check.flagged, persona), corrections: [], flagged: check.flagged, ...usage };
  }

  const raw = await callModel(
    {
      apiKey,
      model: model.model ?? (process.env.CALL_MODEL || DEFAULT_CALL_MODEL),
      fetch: model.fetch ?? fetch,
      timeoutMs: model.timeoutMs ?? TIMEOUT_MS,
    },
    buildSystemPrompt(persona),
    toAnthropicMessages(req.history, req.message),
  );
  if (raw === null) return { ...safeReply('inappropriate', persona), corrections: [], ...usage };

  const parsed = parseModelOutput(raw, persona);
  if (!parsed) return { ...FALLBACK, corrections: [], ...usage };
  if (!checkModelReply(parsed.reply)) return { ...safeReply('inappropriate', persona), corrections: [], ...usage };
  return {
    reply: parsed.reply,
    replyHe: parsed.replyHe,
    corrections: persona.corrects ? parsed.corrections : [],
    ...usage,
  };
}

/**
 * AI video-call practice (shared/call.ts). Signed-in premium learners (PREMIUM_EMAILS allowlist) with
 * CALL_LIMITS, and testers (TESTER_EMAILS) with the shorter TESTER_LIMITS, per local day (server TZ,
 * Asia/Jerusalem by default).
 * Message content is never logged or stored; only per-day counters are.
 */
export function callRouter(
  repo: Repo,
  model: CallModelOptions,
  premiumEmails: Set<string>,
  requireAuth: RequestHandler,
  limiter: RequestHandler,
  testerEmails: Set<string> = new Set(),
) {
  const router = Router();
  const access = (userId: string): CallAccess => {
    const email = repo.findUserById(userId)?.email;
    return isPremium(email, premiumEmails) ? 'premium' : isPremium(email, testerEmails) ? 'tester' : null;
  };

  router.get('/call/status', requireAuth, (_req, res) => {
    const userId = res.locals.userId!;
    const level = access(userId);
    const body: CallStatusResponse = {
      premium: level === 'premium',
      callsToday: repo.getCallUsage(userId, usageDay()).calls,
      callsPerDay: limitsFor(level ?? 'premium').callsPerDay,
    };
    if (level === 'tester') body.tester = true;
    res.json(body);
  });

  router.post('/call/turn', limiter, requireAuth, async (req, res) => {
    const userId = res.locals.userId!;
    const level = access(userId);
    if (!level) throw premiumRequired();
    const limits = limitsFor(level);
    const charge: ChargeTurn = (newCall) => {
      const result = repo.recordCallTurn(userId, usageDay(), newCall, limits);
      if (!result.allowed) throw result.reason === 'calls' ? callsLimit(limits.callsPerDay) : turnsLimit();
      return result.calls;
    };
    const body = await callTurn(req.body, model, charge, limits.maxTurns);
    if (!body) throw badRequest('invalid_call', 'הבקשה לשיחה אינה תקינה');
    res.json(body);
  });

  return router;
}
