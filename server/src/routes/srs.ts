import { Router, type RequestHandler } from 'express';
import type { SrsResponse } from '../../../shared/api';
import { MAX_ITEMS_PER_REQUEST } from '../../../shared/srs';
import { applySrsUpload, sanitizeItemStates } from '../../../shared/srs-merge';
import { HttpError, badRequest } from '../errors';
import type { Repo } from '../repo';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Spaced-repetition state sync (docs/spec/v2.md §6.4–6.5). */
export function srsRouter(repo: Repo, requireAuth: RequestHandler) {
  const router = Router();

  router.get('/srs', requireAuth, (_req, res) => {
    const body: SrsResponse = { items: repo.getSrs(res.locals.userId!) };
    res.json(body);
  });

  /** Uploads a delta: invalid items are dropped, the rest merged per item; responds with the full state. */
  router.put('/srs', requireAuth, (req, res) => {
    const items = isObject(req.body) ? req.body.items : undefined;
    if (!isObject(items)) throw badRequest('invalid_srs', 'נתוני החזרה אינם תקינים');
    if (Object.keys(items).length > MAX_ITEMS_PER_REQUEST) {
      throw new HttpError(413, 'too_many_items', 'יותר מדי פריטים בבקשה אחת');
    }
    const incoming = sanitizeItemStates(items, Date.now(), MAX_ITEMS_PER_REQUEST) ?? {};
    const userId = res.locals.userId!;
    const { items: merged, changed } = applySrsUpload(repo.getSrs(userId), incoming);
    repo.saveSrs(userId, changed);
    const body: SrsResponse = { items: merged };
    res.json(body);
  });

  /** Deletes the whole review state – the learner reset their progress. Responds 204. */
  router.delete('/srs', requireAuth, (_req, res) => {
    repo.deleteSrs(res.locals.userId!);
    res.status(204).end();
  });

  return router;
}
