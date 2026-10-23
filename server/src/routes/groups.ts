import { Router, type RequestHandler } from 'express';
import type {
  GroupLeaderboardResponse,
  GroupMembersResponse,
  GroupResponse,
  GroupsResponse,
} from '../../../shared/api';
import {
  GROUP_ERRORS,
  challengeStats,
  cleanGroupName,
  groupRank,
  isPeriod,
  normalizeInviteCode,
  periodRange,
  previousPeriodRange,
  rankGroups,
  rankMembers,
  summarizeGroup,
  type GroupBase,
  type GroupErrorCode,
  type Period,
  type PeriodRange,
} from '../../../shared/groups';
import { HttpError } from '../errors';
import type { Repo } from '../repo';

const STATUS: Record<GroupErrorCode, number> = {
  invalid_name: 400,
  invalid_code: 400,
  invalid_period: 400,
  group_not_found: 404,
  not_member: 404,
  group_full: 409,
  too_many_groups: 409,
  already_member: 409,
};

const groupError = (code: GroupErrorCode) => new HttpError(STATUS[code], code, GROUP_ERRORS[code]);

/** `?period=` (default week); anything else is a 400. */
export function readPeriod(raw: unknown): Period {
  if (raw === undefined) return 'week';
  if (!isPeriod(raw)) throw groupError('invalid_period');
  return raw;
}

/** [start, end) for SQL: all time ends at the largest safe integer. */
export const bounds = (range: PeriodRange): [number, number] => [range.start, range.end ?? Number.MAX_SAFE_INTEGER];

/** Groups, their weekly challenges and the group leaderboard (shared/groups.ts). */
export function groupsRouter(repo: Repo, requireAuth: RequestHandler, optionalAuth: RequestHandler) {
  const router = Router();

  function summaries(userId: string, now = Date.now()) {
    const week = periodRange('week', now);
    const [start, end] = bounds(week);
    const totals = repo.groupTotals(userId, start, end);
    return (base: GroupBase) =>
      summarizeGroup(base, challengeStats(repo.groupEvents(base.id, start, end)), groupRank(totals, base.id), week);
  }

  function summaryOf(userId: string, groupId: string) {
    const base = repo.myGroups(userId).find((g) => g.id === groupId);
    if (!base) throw groupError('not_member');
    return summaries(userId)(base);
  }

  router.get('/groups/leaderboard', optionalAuth, (req, res) => {
    const period = readPeriod(req.query.period);
    const me = res.locals.userId as string | undefined;
    const range = periodRange(period);
    const previous = previousPeriodRange(period);
    const body: GroupLeaderboardResponse = {
      entries: rankGroups(repo.groupTotals(me, ...bounds(range))),
      endsAt: range.end,
      previousWinners: previous ? rankGroups(repo.groupTotals(me, ...bounds(previous)), 3).slice(0, 3) : [],
    };
    res.json(body);
  });

  router.get('/groups', requireAuth, (_req, res) => {
    const userId = res.locals.userId!;
    const body: GroupsResponse = { groups: repo.myGroups(userId).map(summaries(userId)) };
    res.json(body);
  });

  router.post('/groups', requireAuth, (req, res) => {
    const name = cleanGroupName((req.body ?? {}).name);
    if (!name) throw groupError('invalid_name');
    const userId = res.locals.userId!;
    const created = repo.createGroup(userId, name);
    if (!created.ok) throw groupError(created.error);
    const body: GroupResponse = { group: summaryOf(userId, created.groupId) };
    res.status(201).json(body);
  });

  router.post('/groups/join', requireAuth, (req, res) => {
    const code = normalizeInviteCode((req.body ?? {}).code);
    if (!code) throw groupError('invalid_code');
    const userId = res.locals.userId!;
    const joined = repo.joinGroup(userId, code);
    if (!joined.ok) throw groupError(joined.error);
    const body: GroupResponse = { group: summaryOf(userId, joined.groupId) };
    res.json(body);
  });

  /** A group's own board – for its members only. */
  router.get('/groups/:id/members', requireAuth, (req, res) => {
    const userId = res.locals.userId!;
    const groupId = String(req.params.id);
    if (!repo.isMember(userId, groupId)) throw groupError('not_member');
    const range = periodRange(readPeriod(req.query.period));
    const body: GroupMembersResponse = {
      members: rankMembers(repo.groupMembers(groupId, userId, ...bounds(range))),
    };
    res.json(body);
  });

  router.delete('/groups/:id/membership', requireAuth, (req, res) => {
    if (!repo.leaveGroup(res.locals.userId!, String(req.params.id))) throw groupError('not_member');
    res.status(204).end();
  });

  return router;
}
