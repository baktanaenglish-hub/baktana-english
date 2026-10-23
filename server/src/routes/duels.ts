import { Router, type RequestHandler } from 'express';
import {
  DUEL_ERRORS,
  DUEL_STATUS,
  summarizeDuel,
  summarizeDuels,
  type DuelErrorCode,
  type DuelResponse,
  type DuelsResponse,
} from '../../../shared/duels';
import { normalizeInviteCode } from '../../../shared/groups';
import { HttpError } from '../errors';
import type { Repo } from '../repo';

const duelError = (code: DuelErrorCode) => new HttpError(DUEL_STATUS[code], code, DUEL_ERRORS[code]);

/** Head-to-head duels between two friends (shared/duels.ts). */
export function duelsRouter(repo: Repo, requireAuth: RequestHandler) {
  const router = Router();

  function duelOf(userId: string, duelId: string): DuelResponse {
    const record = repo.myDuels(userId).find((d) => d.id === duelId);
    if (!record) throw duelError('not_in_duel');
    return { duel: summarizeDuel(record) };
  }

  router.get('/duels', requireAuth, (_req, res) => {
    const body: DuelsResponse = { duels: summarizeDuels(repo.myDuels(res.locals.userId!)) };
    res.json(body);
  });

  router.post('/duels', requireAuth, (_req, res) => {
    const userId = res.locals.userId!;
    const created = repo.createDuel(userId);
    if (!created.ok) throw duelError(created.error);
    res.status(201).json(duelOf(userId, created.duelId));
  });

  router.post('/duels/join', requireAuth, (req, res) => {
    const code = normalizeInviteCode((req.body ?? {}).code);
    if (!code) throw duelError('invalid_code');
    const userId = res.locals.userId!;
    const joined = repo.joinDuel(userId, code);
    if (!joined.ok) throw duelError(joined.error);
    res.json(duelOf(userId, joined.duelId));
  });

  /** Withdraws an invite that nobody accepted yet (a running duel can't be left). */
  router.delete('/duels/:id', requireAuth, (req, res) => {
    if (!repo.cancelDuel(res.locals.userId!, String(req.params.id))) throw duelError('not_in_duel');
    res.status(204).end();
  });

  return router;
}
