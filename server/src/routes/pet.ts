import { Router, type RequestHandler } from 'express';
import { checkUserMessage } from '../../../shared/call-safety';
import {
  PET_DESIGNS_PER_DAY,
  PET_DESIGN_SCHEMA,
  buildDesignSystemPrompt,
  buildDesignUserMessage,
  parsePetBadge,
  parsePetDesign,
  sanitizeDesignRequest,
  type PetDesignResponse,
} from '../../../shared/pet-design';
import { isPremium, usageDay } from '../../../shared/premium';
import { HttpError, badRequest } from '../errors';
import type { Repo } from '../repo';
import { DEFAULT_CALL_MODEL, type CallModelOptions } from './call';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 400;
const TIMEOUT_MS = 20_000;

const unavailable = () => new HttpError(503, 'design_unavailable', 'עיצוב עם AI לא זמין כרגע');
const failed = () => new HttpError(502, 'design_failed', 'העיצוב לא הצליח הפעם. נסו שוב בעוד רגע.');
const premiumRequired = () => new HttpError(403, 'premium_required', 'עיצוב חיה ייחודית זמין למנויי פרימיום');
const dailyLimit = () =>
  new HttpError(429, 'daily_limit', `הגעתם ל־${PET_DESIGNS_PER_DAY} עיצובים היום. נמשיך מחר! 🌙`);
const inappropriate = () => new HttpError(400, 'invalid_design', 'נסו לתאר את החיה במילים אחרות 🙂');

/**
 * Designs a premium pet (shared/pet-design.ts) with one Messages API request. Throws HttpError for
 * 400/502/503. The wish is never logged.
 */
export async function designPet(body: unknown, model: CallModelOptions): Promise<PetDesignResponse> {
  const apiKey = model.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw unavailable();
  const req = sanitizeDesignRequest(body);
  if (!req) throw badRequest('invalid_design', 'תארו את החיה שאתם רוצים');
  if (checkUserMessage(req.prompt).flagged) throw inappropriate();

  let res: Response;
  try {
    res = await (model.fetch ?? fetch)(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: model.model ?? (process.env.CALL_MODEL || DEFAULT_CALL_MODEL),
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: PET_DESIGN_SCHEMA } },
        system: buildDesignSystemPrompt(),
        messages: [{ role: 'user', content: buildDesignUserMessage(req) }],
      }),
      signal: AbortSignal.timeout(model.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[pet] upstream request failed: ${(err as Error)?.name ?? 'error'}`);
    throw failed();
  }
  if (!res.ok) {
    console.warn(`[pet] upstream status ${res.status}`);
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
  const design = parsePetDesign(parsed);
  if (!design || checkUserMessage(`${design.name} ${design.bio}`).flagged) throw failed();
  return design;
}

/**
 * POST /api/pet/design: premium learners (PREMIUM_EMAILS) design a unique pet with AI, up to
 * PET_DESIGNS_PER_DAY times a day. The count is kept in memory: a restart starts it over, which is
 * fine for a cost guard.
 */
export function petRouter(
  repo: Repo,
  model: CallModelOptions,
  premiumEmails: Set<string>,
  requireAuth: RequestHandler,
  limiter: RequestHandler,
) {
  const router = Router();
  const usage = new Map<string, number>();

  router.post('/pet/design', limiter, requireAuth, async (req, res) => {
    const userId = res.locals.userId!;
    if (!isPremium(repo.findUserById(userId)?.email, premiumEmails)) throw premiumRequired();
    const key = `${userId}:${usageDay()}`;
    const used = usage.get(key) ?? 0;
    if (used >= PET_DESIGNS_PER_DAY) throw dailyLimit();
    const design = await designPet(req.body, model);
    if (usage.size > 10_000) usage.clear();
    usage.set(key, used + 1);
    res.json(design);
  });

  /** Shares the learner's pet with their groups (shared/pet-design.ts PetBadge); `pet: null` stops sharing. */
  router.put('/me/pet', requireAuth, (req, res) => {
    const raw = (req.body as { pet?: unknown } | undefined)?.pet;
    const pet = raw === null ? null : parsePetBadge(raw);
    if (raw !== null && !pet) throw badRequest('invalid_pet', 'פרטי החיה אינם תקינים');
    repo.setPet(res.locals.userId!, pet);
    res.status(204).end();
  });

  return router;
}
