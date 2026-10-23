import { Router, type RequestHandler } from 'express';
import { sanitizeEvents } from '../../../shared/analytics';
import { badRequest } from '../errors';
import type { Repo } from '../repo';

/**
 * Anonymous analytics events (docs/spec/v2.md §6.4, §8). Auth is optional: with a valid
 * token the rows get that user id, never one from the body. Invalid events are dropped;
 * a batch without any valid event is a 400.
 */
export function eventsRouter(repo: Repo, optionalAuth: RequestHandler, limiter: RequestHandler) {
  const router = Router();

  router.post('/events', limiter, optionalAuth, (req, res) => {
    const raw = (req.body ?? {}) as { events?: unknown };
    const events = sanitizeEvents(raw.events);
    if (events.length === 0) throw badRequest('invalid_events', 'נתוני האירועים אינם תקינים');
    repo.insertEvents(events, res.locals.userId ?? null);
    res.status(204).end();
  });

  return router;
}
