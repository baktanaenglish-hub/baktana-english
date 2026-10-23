/**
 * HTTP contract between the web app (src/) and the server (server/).
 * Both sides import these types – change them only in coordination.
 *
 * All endpoints live under `/api`, exchange JSON, and authenticate with
 * `Authorization: Bearer <token>` where noted. Errors use `ApiError` with a
 * non-2xx status.
 */
import type { Progress } from '../src/lib/progress';
import type { GroupLeaderboardEntry, GroupMember, GroupSummary, Period } from './groups';
import type { ItemStates } from './srs';

export type { Progress };
export type { ItemState, ItemStates } from './srs';
export type { AnalyticsEvent, EventsRequest } from './analytics';
/** POST /api/call/turn (auth optional) – one turn of the AI video call, see shared/call.ts. */
export type { CallTurnRequest, CallTurnResponse } from './call';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  /** Hebrew message that can be shown to the learner as-is. */
  message: string;
}

/** POST /api/auth/register */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Response of register and login. */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * DELETE /api/me (auth) – deletes the account and everything stored with it (progress, XP,
 * review state, analytics events). The password is asked again so a borrowed, signed-in
 * device can't wipe someone's account. Responds 204.
 */
export interface DeleteAccountRequest {
  password: string;
}

/** GET /api/me (auth) */
export interface MeResponse {
  user: User;
  progress: Progress;
}

/**
 * PUT /api/progress (auth) – uploads local progress (e.g. after a guest signs up).
 * The server merges: max xp, union of completed lessons (max count),
 * the later lastActiveDate with its streak. Responds with the merged Progress.
 */
export type SyncProgressRequest = Progress;

/** POST /api/lessons/:lessonId/complete (auth) */
export interface CompleteLessonRequest {
  xp: number;
  accuracy: number;
  /**
   * Optional: the learner's local date (YYYY-MM-DD) when the lesson ended, so
   * streaks follow the device's calendar rather than the server's time zone.
   * Ignored unless it is within one day of the server's date.
   */
  date?: string;
}

/** Response of GET/PUT /api/progress and lesson completion. */
export interface ProgressResponse {
  progress: Progress;
}

/**
 * GET /api/leaderboard[?period=week|month|all] (auth optional) – top learners by XP.
 * Without `period`: the last 7 days (older clients). With it: the calendar week, month or all
 * time in Israel time (shared/groups.ts periodRange); the caller's row is added below the top
 * 20 when it is lower.
 */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  /** XP in the requested period (the name dates from the weekly-only league). */
  weeklyXp: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  /** Set when `period` was asked for: when the period ends (ms), null for all time. */
  endsAt?: number | null;
}

// ---- Groups, challenges and the group leaderboard (shared/groups.ts) ----

export type { GroupLeaderboardEntry, GroupMember, GroupSummary, Period };
export type { ChallengeStatus } from './groups';
/** The learner's pet as their groups see it: PUT /api/me/pet (auth) with SetPetRequest → 204. */
export type { PetBadge, SetPetRequest } from './pet-design';

// ---- Head-to-head duels (shared/duels.ts): GET/POST /api/duels, POST /api/duels/join, DELETE /api/duels/:id ----
export type { DuelResponse, DuelsResponse, DuelSummary, JoinDuelRequest } from './duels';

/** GET /api/groups (auth) – the learner's groups with this week's standing and challenges. */
export interface GroupsResponse {
  groups: GroupSummary[];
}

/** POST /api/groups (auth) – creates a private group with the learner as its first member. */
export interface CreateGroupRequest {
  name: string;
}

/** POST /api/groups/join (auth) – joins with an invite code. */
export interface JoinGroupRequest {
  code: string;
}

/** Response of creating and joining. */
export interface GroupResponse {
  group: GroupSummary;
}

/** GET /api/groups/:id/members?period=week|month|all (auth, members only). */
export interface GroupMembersResponse {
  members: GroupMember[];
}

/**
 * GET /api/groups/leaderboard?period=week|month|all (auth optional) – groups ranked by
 * groupScore (average XP per member). DELETE /api/groups/:id/membership (auth) leaves a group (204).
 */
export interface GroupLeaderboardResponse {
  entries: GroupLeaderboardEntry[];
  /** When the period ends (ms), null for all time. */
  endsAt: number | null;
  /** The top three of the previous week or month (empty for all time). */
  previousWinners: GroupLeaderboardEntry[];
}

/** GET /api/health */
export interface HealthResponse {
  ok: true;
  version: string;
  /** Optional (Could, v2): oldest client version that keeps unknown lesson ids safely. */
  minClientVersion?: string;
}

// ---- v2 additions (docs/spec/v2.md §6.4) ----

/** GET /api/srs (auth) – the learner's full spaced-repetition state. */
export interface SrsResponse {
  items: ItemStates;
}

/**
 * PUT /api/srs (auth) – uploads changed items only (a delta, ≤ MAX_ITEMS_PER_REQUEST).
 * The server sanitizes, merges per item (shared/srs-merge.ts) and responds with the full
 * merged state as SrsResponse.
 */
export interface PutSrsRequest {
  items: ItemStates;
}
