import { randomUUID } from 'node:crypto';
import type { AnalyticsEvent } from '../../shared/analytics';
import type { ItemStates, LeaderboardEntry, User } from '../../shared/api';
import {
  LEADERBOARD_SIZE,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  newInviteCode,
  type GroupBase,
  type GroupErrorCode,
  type GroupTotals,
  type MemberXpEvent,
} from '../../shared/groups';
import {
  DUEL_INVITE_MS,
  DUEL_MS,
  MAX_OPEN_DUELS,
  duelOpen,
  type DuelErrorCode,
  type DuelRecord,
} from '../../shared/duels';
import { parsePetBadge, type PetBadge } from '../../shared/pet-design';
import type { Box } from '../../shared/srs';
import { initialProgress, type Progress } from '../../src/lib/progress';
import type { Db } from './db';

/** A stored pet badge, re-checked on the way out (null when missing or unreadable). */
function readPet(raw: string | null): PetBadge | null {
  if (!raw) return null;
  try {
    return parsePetBadge(JSON.parse(raw));
  } catch {
    return null;
  }
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

export interface StoredUser extends User {
  passwordHash: string;
}

const toUser = (r: UserRow): StoredUser => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  createdAt: r.created_at,
  passwordHash: r.password_hash,
});

export const publicUser = ({ id, email, displayName, createdAt }: StoredUser): User => ({
  id,
  email,
  displayName,
  createdAt,
});

interface SrsRow {
  item_key: string;
  box: number;
  due: string;
  seen: number;
  wrong: number;
  last: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CallUsage {
  calls: number;
  turns: number;
}

/** Outcome of recordCallTurn: `calls` is today's call count after the turn (unchanged when refused). */
export type CallTurnCharge =
  { allowed: true; calls: number } | { allowed: false; reason: 'calls' | 'turns'; calls: number };

/** Outcome of creating or joining a group: its id, or the reason it was refused. */
export type GroupChange = { ok: true; groupId: string } | { ok: false; error: GroupErrorCode };
export type DuelChange = { ok: true; duelId: string } | { ok: false; error: DuelErrorCode };

interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string | null;
  joined_at: number;
  member_count: number;
}

/** Data access for the API, kept in one place so routes stay small. */
export function createRepo(db: Db) {
  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    insertUser: db.prepare(
      'INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    getProgress: db.prepare('SELECT json FROM progress WHERE user_id = ?'),
    upsertProgress: db.prepare(
      `INSERT INTO progress (user_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
    ),
    insertXp: db.prepare('INSERT INTO xp_events (user_id, xp, created_at, lesson) VALUES (?, ?, ?, ?)'),
    periodBoard: db.prepare(
      `SELECT u.id AS id, u.display_name AS displayName, SUM(e.xp) AS xp, MAX(e.created_at) AS lastAt
       FROM xp_events e JOIN users u ON u.id = e.user_id
       WHERE e.created_at >= ? AND e.created_at < ?
       GROUP BY u.id
       HAVING xp > 0
       ORDER BY xp DESC, lastAt ASC`,
    ),
    insertGroup: db.prepare('INSERT INTO groups (id, name, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    groupByCode: db.prepare('SELECT id FROM groups WHERE invite_code = ?'),
    setPet: db.prepare('UPDATE users SET pet = ? WHERE id = ?'),
    insertMember: db.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)'),
    deleteMember: db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?'),
    memberCount: db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?'),
    groupCount: db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?'),
    membership: db.prepare('SELECT joined_at FROM group_members WHERE group_id = ? AND user_id = ?'),
    myGroups: db.prepare(
      `SELECT g.id, g.name, g.invite_code, g.owner_id, m.joined_at,
         (SELECT COUNT(*) FROM group_members c WHERE c.group_id = g.id) AS member_count
       FROM group_members m JOIN groups g ON g.id = m.group_id
       WHERE m.user_id = ?
       ORDER BY m.joined_at`,
    ),
    // Each member's XP counts from when they joined the group.
    groupEvents: db.prepare(
      `SELECT e.user_id AS userId, e.xp, e.lesson, e.created_at AS at
       FROM group_members m JOIN xp_events e ON e.user_id = m.user_id
       WHERE m.group_id = ? AND e.created_at >= MAX(?, m.joined_at) AND e.created_at < ?`,
    ),
    groupMembers: db.prepare(
      `SELECT u.id, u.display_name AS displayName, u.pet, m.joined_at AS joinedAt, g.owner_id AS ownerId,
         COALESCE((SELECT SUM(e.xp) FROM xp_events e
           WHERE e.user_id = m.user_id AND e.created_at >= MAX(?, m.joined_at) AND e.created_at < ?), 0) AS xp
       FROM group_members m JOIN users u ON u.id = m.user_id JOIN groups g ON g.id = m.group_id
       WHERE m.group_id = ?`,
    ),
    groupTotals: db.prepare(
      `SELECT g.id, g.name,
         (SELECT COUNT(*) FROM group_members c WHERE c.group_id = g.id) AS memberCount,
         COALESCE(SUM(e.xp), 0) AS totalXp,
         MAX(CASE WHEN m.user_id = ? THEN 1 ELSE 0 END) AS isMine
       FROM groups g
       JOIN group_members m ON m.group_id = g.id
       LEFT JOIN xp_events e ON e.user_id = m.user_id AND e.created_at >= MAX(?, m.joined_at) AND e.created_at < ?
       GROUP BY g.id`,
    ),
    // Groups left without members go; a group whose owner left passes to its longest-standing member.
    dropEmptyGroups: db.prepare('DELETE FROM groups WHERE id NOT IN (SELECT group_id FROM group_members)'),
    reassignOwners: db.prepare(
      `UPDATE groups SET owner_id = (
         SELECT m.user_id FROM group_members m WHERE m.group_id = groups.id ORDER BY m.joined_at, m.user_id LIMIT 1)
       WHERE owner_id IS NULL OR owner_id NOT IN (SELECT user_id FROM group_members WHERE group_id = groups.id)`,
    ),
    leaderboard: db.prepare(
      `SELECT u.id AS id, u.display_name AS displayName, SUM(e.xp) AS weeklyXp, MAX(e.created_at) AS lastAt
       FROM xp_events e JOIN users u ON u.id = e.user_id
       WHERE e.created_at >= ?
       GROUP BY u.id
       HAVING weeklyXp > 0
       ORDER BY weeklyXp DESC, lastAt ASC
       LIMIT ?`,
    ),
    getSrs: db.prepare('SELECT item_key, box, due, seen, wrong, last FROM srs_state WHERE user_id = ?'),
    deleteSrs: db.prepare('DELETE FROM srs_state WHERE user_id = ?'),
    upsertSrs: db.prepare(
      `INSERT INTO srs_state (user_id, item_key, box, due, seen, wrong, last) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, item_key) DO UPDATE SET
         box = excluded.box, due = excluded.due, seen = excluded.seen, wrong = excluded.wrong, last = excluded.last`,
    ),
    insertEvent: db.prepare(
      `INSERT INTO events (anon_id, user_id, name, lesson_id, item_key, ex_type, correct, first_try, duration_ms,
         props, client_ts, local_date, local_hour, app_version, platform, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    getCallUsage: db.prepare('SELECT calls, turns FROM call_usage WHERE user_id = ? AND day = ?'),
    addCallUsage: db.prepare(
      `INSERT INTO call_usage (user_id, day, calls, turns) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + excluded.calls, turns = turns + 1`,
    ),
    insertDuel: db.prepare('INSERT INTO duels (id, invite_code, challenger_id, created_at) VALUES (?, ?, ?, ?)'),
    duelByCode: db.prepare('SELECT id, challenger_id, opponent_id, created_at FROM duels WHERE invite_code = ?'),
    duelTimes: db.prepare(
      'SELECT created_at AS createdAt, starts_at AS startsAt FROM duels WHERE challenger_id = ? OR opponent_id = ?',
    ),
    acceptDuel: db.prepare('UPDATE duels SET opponent_id = ?, starts_at = ? WHERE id = ? AND opponent_id IS NULL'),
    cancelDuel: db.prepare('DELETE FROM duels WHERE id = ? AND challenger_id = ? AND opponent_id IS NULL'),
    dropExpiredInvites: db.prepare('DELETE FROM duels WHERE opponent_id IS NULL AND created_at < ?'),
    myDuels: db.prepare(
      `SELECT d.id, d.invite_code AS inviteCode, d.challenger_id AS challengerId, d.created_at AS createdAt,
         d.starts_at AS startsAt,
         c.display_name AS cName, c.pet AS cPet, o.display_name AS oName, o.pet AS oPet,
         COALESCE((SELECT SUM(e.xp) FROM xp_events e WHERE e.user_id = d.challenger_id
           AND e.created_at >= d.starts_at AND e.created_at < d.starts_at + ?), 0) AS cXp,
         COALESCE((SELECT SUM(e.xp) FROM xp_events e WHERE e.user_id = d.opponent_id
           AND e.created_at >= d.starts_at AND e.created_at < d.starts_at + ?), 0) AS oXp
       FROM duels d JOIN users c ON c.id = d.challenger_id LEFT JOIN users o ON o.id = d.opponent_id
       WHERE d.challenger_id = ? OR d.opponent_id = ?`,
    ),
  };

  const bool = (v: boolean | undefined) => (v === undefined ? null : v ? 1 : 0);

  /** Open invites and running duels of the learner (shared/duels.ts MAX_OPEN_DUELS). */
  function openDuelCount(userId: string, now = Date.now()): number {
    const rows = q.duelTimes.all(userId, userId) as { createdAt: number; startsAt: number | null }[];
    return rows.filter((r) => duelOpen({ createdAt: Number(r.createdAt), startsAt: r.startsAt }, now)).length;
  }

  function transaction(fn: () => void): void {
    db.exec('BEGIN');
    try {
      fn();
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return {
    findUserById(id: string): StoredUser | undefined {
      const row = q.userById.get(id) as UserRow | undefined;
      return row && toUser(row);
    },
    findUserByEmail(email: string): StoredUser | undefined {
      const row = q.userByEmail.get(email) as UserRow | undefined;
      return row && toUser(row);
    },
    /** Creates the user with fresh progress; returns undefined if the email is taken. */
    createUser(email: string, displayName: string, passwordHash: string, now = Date.now()): StoredUser | undefined {
      const id = randomUUID();
      const createdAt = new Date(now).toISOString();
      db.exec('BEGIN');
      try {
        q.insertUser.run(id, email, displayName, passwordHash, createdAt);
        q.upsertProgress.run(id, JSON.stringify(initialProgress(now)), now);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        if (String((err as Error).message).includes('UNIQUE')) return undefined;
        throw err;
      }
      return { id, email, displayName, createdAt, passwordHash };
    },
    /** Deletes the user; progress, XP, review state, events and call usage go with it (ON DELETE CASCADE). */
    deleteUser(id: string): void {
      transaction(() => {
        q.deleteUser.run(id);
        q.dropEmptyGroups.run();
        q.reassignOwners.run();
      });
    },
    getProgress(userId: string, now = Date.now()): Progress {
      const row = q.getProgress.get(userId) as { json: string } | undefined;
      return row ? (JSON.parse(row.json) as Progress) : initialProgress(now);
    },
    saveProgress(userId: string, progress: Progress, now = Date.now()): void {
      q.upsertProgress.run(userId, JSON.stringify(progress), now);
    },
    /** Saves progress and records earned XP atomically; `lesson` marks XP from a finished lesson. */
    saveLessonResult(userId: string, progress: Progress, xp: number, now = Date.now(), lesson = false): void {
      db.exec('BEGIN');
      try {
        q.upsertProgress.run(userId, JSON.stringify(progress), now);
        if (xp > 0) q.insertXp.run(userId, xp, now, lesson ? 1 : 0);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    /** The learner's full spaced-repetition state. */
    getSrs(userId: string): ItemStates {
      const items: ItemStates = {};
      for (const r of q.getSrs.all(userId) as unknown as SrsRow[]) {
        items[r.item_key] = {
          box: Number(r.box) as Box,
          due: r.due,
          seen: Number(r.seen),
          wrong: Number(r.wrong),
          last: Number(r.last),
        };
      }
      return items;
    },
    /** Writes changed spaced-repetition items in one transaction. */
    /** Forgets the learner's whole review state (progress reset). */
    deleteSrs(userId: string): void {
      q.deleteSrs.run(userId);
    },
    saveSrs(userId: string, changed: ItemStates): void {
      transaction(() => {
        for (const [key, s] of Object.entries(changed)) {
          q.upsertSrs.run(userId, key, s.box, s.due, s.seen, s.wrong, s.last);
        }
      });
    },
    /** Stores validated analytics events; `userId` comes from the token, never the body. */
    insertEvents(events: AnalyticsEvent[], userId: string | null, now = Date.now()): void {
      transaction(() => {
        for (const e of events) {
          q.insertEvent.run(
            e.anonId,
            userId,
            e.name,
            e.lessonId ?? null,
            e.itemKey ?? null,
            e.exType ?? null,
            bool(e.correct),
            bool(e.firstTry),
            e.durationMs ?? null,
            JSON.stringify(e.props ?? {}),
            e.ts,
            e.localDate,
            e.localHour,
            e.appVersion,
            e.platform,
            now,
          );
        }
      });
    },
    /** The learner's video-call usage on `day` (YYYY-MM-DD); zeros when there is no row. */
    getCallUsage(userId: string, day: string): CallUsage {
      const row = q.getCallUsage.get(userId, day) as { calls: number; turns: number } | undefined;
      return { calls: Number(row?.calls ?? 0), turns: Number(row?.turns ?? 0) };
    },
    /**
     * Checks the daily limits and, if allowed, counts one turn (and one call when `newCall`) in a
     * single transaction. Refused when a new call would exceed `callsPerDay` or the turn `turnsPerDay`.
     */
    recordCallTurn(
      userId: string,
      day: string,
      newCall: boolean,
      limits: { callsPerDay: number; turnsPerDay: number },
    ): CallTurnCharge {
      let result: CallTurnCharge = { allowed: true, calls: 0 };
      transaction(() => {
        const row = q.getCallUsage.get(userId, day) as { calls: number; turns: number } | undefined;
        const calls = Number(row?.calls ?? 0);
        const turns = Number(row?.turns ?? 0);
        if (newCall && calls >= limits.callsPerDay) result = { allowed: false, reason: 'calls', calls };
        else if (turns >= limits.turnsPerDay) result = { allowed: false, reason: 'turns', calls };
        else {
          q.addCallUsage.run(userId, day, newCall ? 1 : 0);
          result = { allowed: true, calls: calls + (newCall ? 1 : 0) };
        }
      });
      return result;
    },
    leaderboard(meId: string | undefined, now = Date.now(), limit = 20): LeaderboardEntry[] {
      const rows = q.leaderboard.all(now - WEEK_MS, limit) as { id: string; displayName: string; weeklyXp: number }[];
      return rows.map((r, i) => ({
        rank: i + 1,
        displayName: r.displayName,
        weeklyXp: Number(r.weeklyXp),
        isMe: r.id === meId,
      }));
    },
    /**
     * Learners by XP in [start, end): the top LEADERBOARD_SIZE, plus the caller's own row with
     * its true rank when it is lower.
     */
    periodLeaderboard(meId: string | undefined, start: number, end: number): LeaderboardEntry[] {
      const rows = q.periodBoard.all(start, end) as { id: string; displayName: string; xp: number }[];
      return rows
        .map((r, i) => ({ rank: i + 1, displayName: r.displayName, weeklyXp: Number(r.xp), isMe: r.id === meId }))
        .filter((e) => e.rank <= LEADERBOARD_SIZE || e.isMe);
    },
    createGroup(userId: string, name: string, now = Date.now()): GroupChange {
      let result: GroupChange = { ok: false, error: 'too_many_groups' };
      transaction(() => {
        if (Number((q.groupCount.get(userId) as { n: number }).n) >= MAX_GROUPS_PER_USER) return;
        let code = newInviteCode();
        while (q.groupByCode.get(code)) code = newInviteCode();
        const id = randomUUID();
        q.insertGroup.run(id, name, code, userId, now);
        q.insertMember.run(id, userId, now);
        result = { ok: true, groupId: id };
      });
      return result;
    },
    joinGroup(userId: string, code: string, now = Date.now()): GroupChange {
      let result: GroupChange = { ok: false, error: 'group_not_found' };
      transaction(() => {
        const group = q.groupByCode.get(code) as { id: string } | undefined;
        if (!group) return;
        if (q.membership.get(group.id, userId)) result = { ok: false, error: 'already_member' };
        else if (Number((q.memberCount.get(group.id) as { n: number }).n) >= MAX_GROUP_MEMBERS) {
          result = { ok: false, error: 'group_full' };
        } else if (Number((q.groupCount.get(userId) as { n: number }).n) >= MAX_GROUPS_PER_USER) {
          result = { ok: false, error: 'too_many_groups' };
        } else {
          q.insertMember.run(group.id, userId, now);
          result = { ok: true, groupId: group.id };
        }
      });
      return result;
    },
    /** Leaves the group; false when the learner wasn't a member. */
    leaveGroup(userId: string, groupId: string): boolean {
      let left = false;
      transaction(() => {
        left = Number(q.deleteMember.run(groupId, userId).changes) > 0;
        if (!left) return;
        q.dropEmptyGroups.run();
        q.reassignOwners.run();
      });
      return left;
    },
    isMember(userId: string, groupId: string): boolean {
      return q.membership.get(groupId, userId) !== undefined;
    },
    /** The learner's groups, oldest membership first. */
    myGroups(userId: string): GroupBase[] {
      return (q.myGroups.all(userId) as unknown as GroupRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        inviteCode: r.invite_code,
        memberCount: Number(r.member_count),
        isOwner: r.owner_id === userId,
        joinedAt: Number(r.joined_at),
      }));
    },
    /** Members' XP rows in [start, end), each from when that member joined. */
    groupEvents(groupId: string, start: number, end: number): MemberXpEvent[] {
      const rows = q.groupEvents.all(groupId, start, end) as {
        userId: string;
        xp: number;
        lesson: number;
        at: number;
      }[];
      return rows.map((r) => ({
        userId: r.userId,
        xp: Number(r.xp),
        lesson: Number(r.lesson) === 1,
        at: Number(r.at),
      }));
    },
    groupMembers(groupId: string, meId: string, start: number, end: number) {
      const rows = q.groupMembers.all(start, end, groupId) as {
        id: string;
        displayName: string;
        joinedAt: number;
        ownerId: string | null;
        xp: number;
        pet: string | null;
      }[];
      return rows.map((r) => ({
        displayName: r.displayName,
        xp: Number(r.xp),
        isMe: r.id === meId,
        isOwner: r.id === r.ownerId,
        joinedAt: Number(r.joinedAt),
        pet: readPet(r.pet),
      }));
    },
    /** Stores the pet the learner's groups see (null stops sharing it). */
    setPet(userId: string, pet: PetBadge | null) {
      q.setPet.run(pet ? JSON.stringify(pet) : null, userId);
    },
    openDuelCount,
    createDuel(userId: string, now = Date.now()): DuelChange {
      let result: DuelChange = { ok: false, error: 'too_many_duels' };
      transaction(() => {
        q.dropExpiredInvites.run(now - DUEL_INVITE_MS);
        if (openDuelCount(userId, now) >= MAX_OPEN_DUELS) return;
        let code = newInviteCode();
        while (q.duelByCode.get(code)) code = newInviteCode();
        const id = randomUUID();
        q.insertDuel.run(id, code, userId, now);
        result = { ok: true, duelId: id };
      });
      return result;
    },
    /** Accepts an open invite: the duel starts now. */
    joinDuel(userId: string, code: string, now = Date.now()): DuelChange {
      let result: DuelChange = { ok: false, error: 'duel_not_found' };
      transaction(() => {
        const duel = q.duelByCode.get(code) as
          { id: string; challenger_id: string; opponent_id: string | null; created_at: number } | undefined;
        if (!duel || duel.opponent_id !== null || Number(duel.created_at) + DUEL_INVITE_MS <= now) return;
        if (duel.challenger_id === userId) result = { ok: false, error: 'own_duel' };
        else if (openDuelCount(userId, now) >= MAX_OPEN_DUELS) result = { ok: false, error: 'too_many_duels' };
        else {
          q.acceptDuel.run(userId, now, duel.id);
          result = { ok: true, duelId: duel.id };
        }
      });
      return result;
    },
    /** Withdraws an invite nobody accepted yet; false when there is no such invite of the learner. */
    cancelDuel(userId: string, duelId: string): boolean {
      return Number(q.cancelDuel.run(duelId, userId).changes) > 0;
    },
    /** Every duel of the learner, from their side (shared/duels.ts summarizeDuels filters and sorts). */
    myDuels(userId: string): DuelRecord[] {
      const rows = q.myDuels.all(DUEL_MS, DUEL_MS, userId, userId) as {
        id: string;
        inviteCode: string;
        challengerId: string;
        createdAt: number;
        startsAt: number | null;
        cName: string;
        cPet: string | null;
        oName: string | null;
        oPet: string | null;
        cXp: number;
        oXp: number;
      }[];
      return rows.map((r) => {
        const challenger = { displayName: r.cName, xp: Number(r.cXp), pet: readPet(r.cPet) };
        const opponent = r.oName === null ? null : { displayName: r.oName, xp: Number(r.oXp), pet: readPet(r.oPet) };
        const isChallenger = r.challengerId === userId;
        return {
          id: r.id,
          inviteCode: r.inviteCode,
          isChallenger,
          createdAt: Number(r.createdAt),
          startsAt: r.startsAt === null ? null : Number(r.startsAt),
          me: isChallenger ? challenger : opponent!,
          opponent: isChallenger ? opponent : challenger,
        };
      });
    },
    /** Every group's member count and XP in [start, end); `isMine` marks the caller's groups. */
    groupTotals(meId: string | undefined, start: number, end: number): GroupTotals[] {
      const rows = q.groupTotals.all(meId ?? null, start, end) as {
        id: string;
        name: string;
        memberCount: number;
        totalXp: number;
        isMine: number;
      }[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: Number(r.memberCount),
        totalXp: Number(r.totalXp),
        isMine: Number(r.isMine) === 1,
      }));
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
