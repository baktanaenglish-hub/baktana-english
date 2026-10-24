/**
 * Groups, group challenges and the period leaderboards. Pure rules shared by the Express server,
 * the Supabase client (src/lib/cloud.ts) and the web app, so every backend ranks and scores alike.
 *
 * Points are the app's existing XP (xp_events). A member's XP counts for a group from the moment
 * they joined it, so hopping between groups can't carry old XP along.
 */

/** Leaderboard periods: the calendar week (from Sunday), the calendar month, or all time. */
import type { PetBadge } from './pet-design';

export type Period = 'week' | 'month' | 'all';
export const PERIODS: Period[] = ['week', 'month', 'all'];

export const PERIOD_LABELS: Record<Period, string> = { week: 'השבוע', month: 'החודש', all: 'מצטבר' };

/** Periods follow the learners' calendar, which is Israel's. */
export const TIME_ZONE = 'Asia/Jerusalem';

export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 30;
export const MAX_GROUP_MEMBERS = 30;
export const MAX_GROUPS_PER_USER = 5;
/** Rows shown on a leaderboard (the caller's own row is added below them when it is lower). */
export const LEADERBOARD_SIZE = 20;

/** Invite codes skip look-alike characters (0/O, 1/I/L) so they can be read out loud. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/**
 * Fair ranking between groups of different sizes: the average XP per member, where groups
 * smaller than FAIR_GROUP_SIZE count as that size – so a big group doesn't win on numbers alone,
 * and a group of one can't top the board with a single busy week.
 * supabase/schema.sql has no copy of this: the Supabase client ranks with rankGroups() too.
 */
export const FAIR_GROUP_SIZE = 3;

export function groupScore(totalXp: number, members: number): number {
  return Math.round(totalXp / Math.max(members, FAIR_GROUP_SIZE));
}

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as string[]).includes(value);
}

/** A trimmed group name of 2–30 characters (whitespace collapsed), or null. */
export function cleanGroupName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  const length = [...name].length;
  return length >= GROUP_NAME_MIN && length <= GROUP_NAME_MAX ? name : null;
}

/** An invite code as typed or pasted (any case, spaces and dashes ignored), or null. */
export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== INVITE_CODE_LENGTH) return null;
  return [...code].every((c) => INVITE_ALPHABET.includes(c)) ? code : null;
}

export function newInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  return code;
}

/** The join link shared with friends: the app's address with `?join=CODE`. */
export function inviteLink(base: string, code: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.href;
}

// ---- Calendar periods in Israel time ----

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Israel's wall-clock time at `t`, read as if it were UTC. */
function zonedAsUtc(t: number): number {
  const parts: Record<string, number> = {};
  for (const p of wallClock.formatToParts(new Date(t))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** The instant Israel's clocks show midnight on the given calendar day. */
function zonedMidnight(year: number, month: number, day: number): number {
  const wall = Date.UTC(year, month, day);
  let t = wall - (zonedAsUtc(wall) - wall);
  // A second pass settles the offset when the first guess lands across a DST change.
  t = wall - (zonedAsUtc(t) - t);
  return t;
}

/** Israel's calendar date (YYYY-MM-DD) at `t`. */
export function zonedDateKey(t: number): string {
  return new Date(zonedAsUtc(t)).toISOString().slice(0, 10);
}

export interface PeriodRange {
  /** Inclusive start (ms); 0 for all time. */
  start: number;
  /** Exclusive end (ms); null for all time. */
  end: number | null;
}

/** The current calendar week (Sunday to Saturday), month or all time, in Israel time. */
export function periodRange(period: Period, now = Date.now()): PeriodRange {
  if (period === 'all') return { start: 0, end: null };
  const today = new Date(zonedAsUtc(now));
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  if (period === 'month') return { start: zonedMidnight(y, m, 1), end: zonedMidnight(y, m + 1, 1) };
  const sunday = d - today.getUTCDay();
  return { start: zonedMidnight(y, m, sunday), end: zonedMidnight(y, m, sunday + 7) };
}

/** The period just before the current one (null for all time) – for last period's winners. */
export function previousPeriodRange(period: Period, now = Date.now()): PeriodRange | null {
  if (period === 'all') return null;
  const { start } = periodRange(period, now);
  return { start: periodRange(period, start - 1).start, end: start };
}

// ---- Ranking ----

/** A group's XP in a period, as the backends report it. */
export interface GroupTotals {
  id: string;
  name: string;
  memberCount: number;
  totalXp: number;
  isMine: boolean;
}

export interface GroupLeaderboardEntry {
  rank: number;
  name: string;
  memberCount: number;
  totalXp: number;
  /** groupScore(): average XP per member, with the FAIR_GROUP_SIZE floor. */
  score: number;
  isMine: boolean;
}

/** Groups with XP in the period, best score first (ties: more XP, then name). */
function sortGroups(rows: GroupTotals[]): (GroupTotals & { score: number })[] {
  return rows
    .filter((r) => r.totalXp > 0)
    .map((r) => ({ ...r, score: groupScore(r.totalXp, r.memberCount) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.totalXp - a.totalXp ||
        a.name.localeCompare(b.name, 'he') ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

/** The top LEADERBOARD_SIZE groups, plus the caller's own groups below them with their true rank. */
export function rankGroups(rows: GroupTotals[], size = LEADERBOARD_SIZE): GroupLeaderboardEntry[] {
  return sortGroups(rows)
    .map(({ name, memberCount, totalXp, score, isMine }, i) => ({
      rank: i + 1,
      name,
      memberCount,
      totalXp,
      score,
      isMine,
    }))
    .filter((r) => r.rank <= size || r.isMine);
}

/** The rank of `groupId` among `rows`, or null without XP in the period. */
export function groupRank(rows: GroupTotals[], groupId: string): number | null {
  const i = sortGroups(rows).findIndex((r) => r.id === groupId);
  return i < 0 ? null : i + 1;
}

// ---- Weekly group challenges ----

export type ChallengeKind = 'xp' | 'lessons' | 'days';

/** What a group did this week, counted from the XP its members earned since joining. */
export interface ChallengeStats {
  xp: number;
  /** Finished lessons. */
  lessons: number;
  /** Member-days with any XP (each member counts once per calendar day). */
  activeDays: number;
}

export interface Challenge {
  /** Unique per group and week: `${kind}:${weekStart}`. */
  id: string;
  kind: ChallengeKind;
  icon: string;
  title: string;
  goal: number;
  /** Gems each member receives when the group completes it. */
  gems: number;
}

export interface ChallengeStatus extends Challenge {
  progress: number;
  done: boolean;
}

/** Per-member targets; the week's set rotates so the challenges change every Sunday. */
const CHALLENGE_LEVELS: Record<ChallengeKind, number>[] = [
  { xp: 100, lessons: 5, days: 3 },
  { xp: 150, lessons: 7, days: 4 },
  { xp: 120, lessons: 6, days: 5 },
];

const CHALLENGE_GEMS: Record<ChallengeKind, number> = { xp: 20, lessons: 20, days: 25 };

/**
 * The group's three challenges for the week starting at `weekStart`. Goals scale with the
 * number of members, so a small group and a big one face the same effort per person.
 */
export function weeklyChallenges(weekStart: number, memberCount: number): Challenge[] {
  const members = Math.max(1, memberCount);
  const level = CHALLENGE_LEVELS[Math.abs(Math.round(weekStart / WEEK_MS)) % CHALLENGE_LEVELS.length];
  const xp = level.xp * members;
  const lessons = level.lessons * members;
  const days = level.days * members;
  return [
    { id: `xp:${weekStart}`, kind: 'xp', icon: '⚡', title: `צברו יחד ${xp} XP`, goal: xp, gems: CHALLENGE_GEMS.xp },
    {
      id: `lessons:${weekStart}`,
      kind: 'lessons',
      icon: '📚',
      title: `השלימו יחד ${lessons} שיעורים`,
      goal: lessons,
      gems: CHALLENGE_GEMS.lessons,
    },
    {
      id: `days:${weekStart}`,
      kind: 'days',
      icon: '🔥',
      title: members === 1 ? `למדו ${days} ימים השבוע` : `כל אחד לומד ${level.days} ימים השבוע (${days} ימי לימוד)`,
      goal: days,
      gems: CHALLENGE_GEMS.days,
    },
  ];
}

export function challengeStatus(challenges: Challenge[], stats: ChallengeStats): ChallengeStatus[] {
  return challenges.map((c) => {
    const value = c.kind === 'xp' ? stats.xp : c.kind === 'lessons' ? stats.lessons : stats.activeDays;
    return { ...c, progress: Math.min(c.goal, Math.max(0, value)), done: value >= c.goal };
  });
}

/** One XP row of a group member (only rows from after they joined). */
export interface MemberXpEvent {
  userId: string;
  xp: number;
  /** True for a finished lesson, false for XP that arrived with a progress sync. */
  lesson: boolean;
  at: number;
}

export function challengeStats(events: MemberXpEvent[]): ChallengeStats {
  const days = new Set<string>();
  let xp = 0;
  let lessons = 0;
  for (const e of events) {
    xp += e.xp;
    if (e.lesson) lessons++;
    if (e.xp > 0) days.add(`${e.userId}|${zonedDateKey(e.at)}`);
  }
  return { xp, lessons, activeDays: days.size };
}

/** A group the learner belongs to, with this week's standing and challenges. */
export interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  isOwner: boolean;
  /** When the learner joined (ms). */
  joinedAt: number;
  /** The current calendar week (ms), which the challenges and week figures belong to. */
  weekStart: number;
  weekEnd: number;
  weekXp: number;
  weekScore: number;
  /** Place on this week's group leaderboard; null before the group earns XP this week. */
  weekRank: number | null;
  challenges: ChallengeStatus[];
}

export interface GroupBase {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  isOwner: boolean;
  joinedAt: number;
}

export function summarizeGroup(
  base: GroupBase,
  stats: ChallengeStats,
  weekRank: number | null,
  week: PeriodRange,
): GroupSummary {
  return {
    ...base,
    weekStart: week.start,
    weekEnd: week.end ?? week.start + WEEK_MS,
    weekXp: stats.xp,
    weekScore: groupScore(stats.xp, base.memberCount),
    weekRank,
    challenges: challengeStatus(weeklyChallenges(week.start, base.memberCount), stats),
  };
}

/** A member on a group's own board for a period. */
export interface GroupMember {
  rank: number;
  displayName: string;
  xp: number;
  isMe: boolean;
  isOwner: boolean;
  /** The member's personal pet, when they share one (shared/pet-design.ts). */
  pet?: PetBadge | null;
}

/** Members by XP in the period (ties: who joined first), ranked from 1. */
export function rankMembers(
  rows: { displayName: string; xp: number; isMe: boolean; isOwner: boolean; joinedAt: number; pet?: PetBadge | null }[],
): GroupMember[] {
  return [...rows]
    .sort((a, b) => b.xp - a.xp || a.joinedAt - b.joinedAt)
    .map(({ displayName, xp, isMe, isOwner, pet }, i) => ({
      rank: i + 1,
      displayName,
      xp,
      isMe,
      isOwner,
      ...(pet ? { pet } : {}),
    }));
}

/** Hebrew messages for the group errors both backends report. */
export const GROUP_ERRORS = {
  invalid_name: `שם הקבוצה צריך להיות באורך ${GROUP_NAME_MIN}–${GROUP_NAME_MAX} תווים`,
  invalid_code: 'קוד ההצטרפות לא תקין. בדקו אותו ונסו שוב.',
  group_not_found: 'לא מצאנו קבוצה עם הקוד הזה',
  group_full: `הקבוצה מלאה (עד ${MAX_GROUP_MEMBERS} חברים)`,
  too_many_groups: `אפשר להיות בעד ${MAX_GROUPS_PER_USER} קבוצות בבת אחת`,
  already_member: 'כבר הצטרפתם לקבוצה הזאת',
  not_member: 'הקבוצה לא נמצאה, או שכבר לא חברים בה',
  invalid_period: 'תקופת הדירוג אינה תקינה',
} as const;

export type GroupErrorCode = keyof typeof GROUP_ERRORS;
