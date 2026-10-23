import { Router, type RequestHandler } from 'express';
import type { LeaderboardResponse } from '../../../shared/api';
import { periodRange } from '../../../shared/groups';
import type { Repo } from '../repo';
import { bounds, readPeriod } from './groups';

export function leaderboardRouter(repo: Repo, optionalAuth: RequestHandler) {
  const router = Router();

  /** The personal league; requests without `period` keep the rolling 7 days older clients expect. */
  router.get('/leaderboard', optionalAuth, (req, res) => {
    const me = res.locals.userId as string | undefined;
    if (req.query.period === undefined) {
      const body: LeaderboardResponse = { entries: repo.leaderboard(me) };
      return void res.json(body);
    }
    const range = periodRange(readPeriod(req.query.period));
    const body: LeaderboardResponse = { entries: repo.periodLeaderboard(me, ...bounds(range)), endsAt: range.end };
    res.json(body);
  });

  return router;
}
