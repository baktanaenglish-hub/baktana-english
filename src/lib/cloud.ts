import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthResponse,
  CompleteLessonRequest,
  GroupLeaderboardResponse,
  GroupMembersResponse,
  GroupResponse,
  GroupsResponse,
  ItemStates,
  LeaderboardResponse,
  LoginRequest,
  ProgressResponse,
  RegisterRequest,
  SrsResponse,
  User,
} from '../../shared/api';
import {
  GROUP_ERRORS,
  cleanGroupName,
  groupRank,
  normalizeInviteCode,
  periodRange,
  previousPeriodRange,
  rankGroups,
  rankMembers,
  summarizeGroup,
  type GroupErrorCode,
  type GroupTotals,
  type Period,
  type PeriodRange,
} from '../../shared/groups';
import {
  DUEL_ERRORS,
  DUEL_STATUS,
  summarizeDuel,
  summarizeDuels,
  type DuelErrorCode,
  type DuelRecord,
  type DuelResponse,
  type DuelsResponse,
} from '../../shared/duels';
import { parsePetBadge, type PetBadge } from '../../shared/pet-design';
import { MAX_LESSON_XP, mergeProgress, plausibleLocalDate, sanitizeProgress } from '../../shared/progress-merge';
import { MAX_ITEMS_PER_REQUEST } from '../../shared/srs';
import { sanitizeItemStates } from '../../shared/srs-merge';
import { findLesson } from '../data/course';
import { completeLesson, dateKey, initialProgress, isUnlocked, type Progress } from './progress';
import { ApiRequestError, OFFLINE_MESSAGE } from './api-error';
import { authRedirectUrl } from './config';

/**
 * The same operations as the REST client in api.ts, backed by Supabase (auth + Postgres,
 * schema in supabase/schema.sql). The rules the Express server enforces run here on the
 * client; row-level security keeps each learner to their own rows.
 */

/** Marker kept in StoredAuth – supabase-js stores and refreshes the real session itself. */
export const CLOUD_TOKEN = 'supabase';

const NOT_SIGNED_IN = 'צריך להתחבר כדי לעשות את זה.';
const INVALID_SRS = 'נתוני החזרה אינם תקינים';

/** A row of public.srs_state (supabase/schema.sql). */
interface SrsRow {
  item_key: string;
  box: number;
  due: string;
  seen: number;
  wrong: number;
  last: number | string;
}

/** Rows → ItemStates, validated like an upload (bigint `last` may arrive as a string). */
function rowsToItems(rows: SrsRow[] | null | undefined): ItemStates {
  const raw: Record<string, unknown> = {};
  for (const r of rows ?? []) {
    raw[r.item_key] = {
      box: Number(r.box),
      due: String(r.due).slice(0, 10),
      seen: Number(r.seen),
      wrong: Number(r.wrong),
      last: Number(r.last),
    };
  }
  return sanitizeItemStates(raw, Date.now(), Number.POSITIVE_INFINITY) ?? {};
}

/** Maps Supabase/network failures to ApiRequestError with a Hebrew message. */
export function cloudError(
  error: { message?: string; status?: number; code?: string } | null | undefined,
): ApiRequestError {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  if (/fetch|network|Load failed/i.test(message)) return new ApiRequestError(0, 'network', OFFLINE_MESSAGE);
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new ApiRequestError(401, 'invalid_credentials', 'האימייל או הסיסמה שגויים.');
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return new ApiRequestError(409, 'email_taken', 'כבר קיים חשבון עם האימייל הזה. נסו להתחבר.');
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new ApiRequestError(403, 'email_not_confirmed', 'צריך לאשר את כתובת האימייל – בדקו את תיבת הדואר.');
  }
  if (code === 'same_password') {
    return new ApiRequestError(422, 'same_password', 'זו הסיסמה הנוכחית. בחרו סיסמה חדשה.');
  }
  if (code === 'weak_password' || /password/i.test(message)) {
    return new ApiRequestError(400, 'weak_password', 'הסיסמה חלשה מדי. בחרו סיסמה ארוכה יותר.');
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error?.status === 429) {
    return new ApiRequestError(429, 'rate_limited', 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');
  }
  return new ApiRequestError(error?.status && error.status < 500 ? error.status : 0, code || 'cloud', OFFLINE_MESSAGE);
}

const GROUP_STATUS: Record<GroupErrorCode, number> = {
  invalid_name: 400,
  invalid_code: 400,
  invalid_period: 400,
  group_not_found: 404,
  not_member: 404,
  group_full: 409,
  too_many_groups: 409,
  already_member: 409,
};

/** The group functions in schema.sql raise the error code as the message (e.g. `group_full`). */
function groupError(error: { message?: string; status?: number; code?: string }): ApiRequestError {
  const code = (error.message ?? '').trim();
  if (code in GROUP_ERRORS) {
    const known = code as GroupErrorCode;
    return new ApiRequestError(GROUP_STATUS[known], known, GROUP_ERRORS[known]);
  }
  if (code === 'not_signed_in') return new ApiRequestError(401, 'unauthorized', NOT_SIGNED_IN);
  return cloudError(error);
}

function duelError(error: { message?: string; status?: number; code?: string }): ApiRequestError {
  const code = (error.message ?? '').trim();
  if (code in DUEL_ERRORS) {
    const known = code as DuelErrorCode;
    return new ApiRequestError(DUEL_STATUS[known], known, DUEL_ERRORS[known]);
  }
  if (code === 'not_signed_in') return new ApiRequestError(401, 'unauthorized', NOT_SIGNED_IN);
  return cloudError(error);
}

interface DuelRow {
  id: string;
  invite_code: string;
  is_challenger: boolean;
  created_at: string;
  starts_at: string | null;
  my_name: string;
  my_pet: unknown;
  my_xp: number | string;
  opp_name: string | null;
  opp_pet: unknown;
  opp_xp: number | string;
}

/** A my_duels() row as the DuelRecord shared/duels.ts summarizes. */
export function duelRecord(r: DuelRow): DuelRecord {
  return {
    id: r.id,
    inviteCode: r.invite_code,
    isChallenger: r.is_challenger,
    createdAt: Date.parse(r.created_at),
    startsAt: r.starts_at === null ? null : Date.parse(r.starts_at),
    me: { displayName: r.my_name, xp: Number(r.my_xp), pet: parsePetBadge(r.my_pet) },
    opponent:
      r.opp_name === null ? null : { displayName: r.opp_name, xp: Number(r.opp_xp), pet: parsePetBadge(r.opp_pet) },
  };
}

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
const rangeArgs = (r: PeriodRange) => ({ since: iso(r.start), until: iso(r.end) });

interface GroupTotalsRow {
  id: string;
  name: string;
  member_count: number;
  total_xp: number | string;
  is_mine: boolean;
}

const toTotals = (rows: GroupTotalsRow[] | null): GroupTotals[] =>
  (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    memberCount: Number(r.member_count),
    totalXp: Number(r.total_xp),
    isMine: r.is_mine,
  }));

export function createCloudApi(getClient: () => Promise<SupabaseClient>) {
  async function userId(client: SupabaseClient): Promise<string> {
    const { data, error } = await client.auth.getSession();
    if (error) throw cloudError(error);
    const id = data.session?.user.id;
    if (!id) throw new ApiRequestError(401, 'unauthorized', NOT_SIGNED_IN);
    return id;
  }

  async function loadProgress(client: SupabaseClient, id: string, now: number): Promise<Progress> {
    const { data, error } = await client.from('progress').select('data').eq('user_id', id).maybeSingle();
    if (error) throw cloudError(error);
    return (data && sanitizeProgress(data.data, now)) || initialProgress(now);
  }

  async function save(client: SupabaseClient, id: string, progress: Progress, xp: number, lesson = false) {
    const { error } = await client
      .from('progress')
      .upsert({ user_id: id, data: progress, updated_at: new Date().toISOString() });
    if (error) throw cloudError(error);
    if (xp > 0) {
      let { error: xpError } = await client
        .from('xp_events')
        .insert({ user_id: id, xp, ...(lesson ? { lesson } : {}) });
      // A database from before the groups update has no `lesson` column yet – the XP still counts.
      if (xpError && lesson && /lesson/.test(xpError.message ?? '')) {
        ({ error: xpError } = await client.from('xp_events').insert({ user_id: id, xp }));
      }
      if (xpError) throw cloudError(xpError);
    }
  }

  async function groupTotals(client: SupabaseClient, range: PeriodRange): Promise<GroupTotals[]> {
    const { data, error } = await client.rpc('group_totals', rangeArgs(range));
    if (error) throw groupError(error);
    return toTotals(data as GroupTotalsRow[] | null);
  }

  /** Same as GET /api/groups: the learner's groups, this week's rank and challenges. */
  async function myGroups(client: SupabaseClient): Promise<GroupsResponse> {
    await userId(client);
    const week = periodRange('week');
    const { data, error } = await client.rpc('my_groups', { week_start: iso(week.start), week_end: iso(week.end) });
    if (error) throw groupError(error);
    const totals = await groupTotals(client, week);
    const rows = (data ?? []) as {
      id: string;
      name: string;
      invite_code: string;
      member_count: number;
      is_owner: boolean;
      joined_at: string;
      xp: number | string;
      lessons: number | string;
      active_days: number | string;
    }[];
    return {
      groups: rows.map((r) =>
        summarizeGroup(
          {
            id: r.id,
            name: r.name,
            inviteCode: r.invite_code,
            memberCount: Number(r.member_count),
            isOwner: r.is_owner,
            joinedAt: Date.parse(r.joined_at),
          },
          { xp: Number(r.xp), lessons: Number(r.lessons), activeDays: Number(r.active_days) },
          groupRank(totals, r.id),
          week,
        ),
      ),
    };
  }

  async function groupById(client: SupabaseClient, id: string): Promise<GroupResponse> {
    const group = (await myGroups(client)).groups.find((g) => g.id === id);
    if (!group) throw groupError({ message: 'not_member' });
    return { group };
  }

  /** Same as GET /api/duels. */
  async function myDuels(client: SupabaseClient): Promise<DuelRecord[]> {
    await userId(client);
    const { data, error } = await client.rpc('my_duels');
    if (error) throw duelError(error);
    return ((data ?? []) as DuelRow[]).map(duelRecord);
  }

  async function duelById(client: SupabaseClient, id: string): Promise<DuelResponse> {
    const record = (await myDuels(client)).find((d) => d.id === id);
    if (!record) throw duelError({ message: 'not_in_duel' });
    return { duel: summarizeDuel(record) };
  }

  async function toAuthResponse(
    client: SupabaseClient,
    user: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> },
  ): Promise<AuthResponse> {
    const { data } = await client.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    const fromMeta = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';
    const result: User = {
      id: user.id,
      email: user.email ?? '',
      displayName: data?.display_name ?? fromMeta,
      createdAt: user.created_at,
    };
    return { token: CLOUD_TOKEN, user: result };
  }

  return {
    async register(req: RegisterRequest): Promise<AuthResponse> {
      const client = await getClient();
      const { data, error } = await client.auth.signUp({
        email: req.email,
        password: req.password,
        options: { data: { display_name: req.displayName }, emailRedirectTo: authRedirectUrl() },
      });
      if (error) throw cloudError(error);
      // With "Confirm email" on, Supabase returns no session until the link is clicked;
      // an already-registered address also comes back this way (with no identities).
      if (!data.session || !data.user) {
        if (data.user && data.user.identities?.length === 0) throw cloudError({ code: 'user_already_exists' });
        throw new ApiRequestError(
          202,
          'confirm_email',
          'שלחנו אליך מייל לאישור החשבון. אחרי שתלחצו על הקישור, חזרו לכאן והתחברו.',
        );
      }
      return toAuthResponse(client, data.user);
    },

    async login(req: LoginRequest): Promise<AuthResponse> {
      const client = await getClient();
      const { data, error } = await client.auth.signInWithPassword({ email: req.email, password: req.password });
      if (error) throw cloudError(error);
      return toAuthResponse(client, data.user);
    },

    async signOut(): Promise<void> {
      const client = await getClient();
      await client.auth.signOut().catch(() => undefined);
    },

    /**
     * Emails a link for choosing a new password. Supabase answers the same whether or not the
     * address has an account, so the form can't be used to find out who is registered.
     */
    async requestPasswordReset(email: string): Promise<void> {
      const client = await getClient();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
      if (error) throw cloudError(error);
    },

    /**
     * Sets a new password after the reset link was opened: supabase-js reads the link's session
     * from the URL when the client starts, so the learner is signed in once this returns.
     */
    async setNewPassword(password: string): Promise<AuthResponse> {
      const client = await getClient();
      try {
        await userId(client);
      } catch (err) {
        if (err instanceof ApiRequestError && err.unauthorized) {
          throw new ApiRequestError(401, 'reset_link_expired', 'הקישור לא בתוקף יותר. בקשו קישור חדש.');
        }
        throw err;
      }
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw cloudError(error);
      return toAuthResponse(client, data.user);
    },

    /**
     * Deletes the account (same as DELETE /api/me): signing in again checks the password, then
     * the `delete_my_account` RPC removes the auth user, and every table cascades with it.
     */
    async deleteAccount(password: string): Promise<void> {
      const client = await getClient();
      await userId(client);
      const { data } = await client.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new ApiRequestError(401, 'unauthorized', NOT_SIGNED_IN);
      const { error: authError } = await client.auth.signInWithPassword({ email, password });
      if (authError) {
        const err = cloudError(authError);
        throw err.code === 'invalid_credentials'
          ? new ApiRequestError(401, 'invalid_credentials', 'הסיסמה שגויה.')
          : err;
      }
      const { error } = await client.rpc('delete_my_account');
      if (error) throw cloudError(error);
      // The session belongs to a user that no longer exists – just forget it on this device.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },

    /** Merges uploaded progress with the stored copy (same rules as PUT /api/progress). */
    async putProgress(progress: Progress): Promise<ProgressResponse> {
      const client = await getClient();
      const id = await userId(client);
      const now = Date.now();
      const incoming = sanitizeProgress(progress, now);
      if (!incoming) throw new ApiRequestError(400, 'invalid_progress', 'נתוני ההתקדמות אינם תקינים');
      const stored = await loadProgress(client, id, now);
      const merged = mergeProgress(stored, incoming, now);
      // XP that never went through completeLesson (practice, offline lessons) counts for the
      // league too, capped per sync like a single lesson.
      await save(client, id, merged, Math.max(0, Math.min(MAX_LESSON_XP, merged.xp - stored.xp)));
      return { progress: merged };
    },

    /** Records a finished lesson (same checks as POST /api/lessons/:id/complete). */
    async completeLesson(lessonId: string, req: CompleteLessonRequest): Promise<ProgressResponse> {
      if (!findLesson(lessonId)) throw new ApiRequestError(404, 'lesson_not_found', 'השיעור לא נמצא');
      const client = await getClient();
      const id = await userId(client);
      const now = Date.now();
      const current = await loadProgress(client, id, now);
      if (!isUnlocked(current, lessonId)) {
        throw new ApiRequestError(403, 'lesson_locked', 'השיעור הזה עדיין נעול – סיימו קודם את השיעור הקודם');
      }
      const xp = Math.max(0, Math.min(MAX_LESSON_XP, Math.round(req.xp)));
      const today = plausibleLocalDate(req.date, now) ?? dateKey(now);
      const progress = completeLesson(current, lessonId, xp, now, today);
      await save(client, id, progress, xp, true);
      return { progress };
    },

    /** The learner's spaced-repetition state (same as GET /api/srs; RLS keeps it to their rows). */
    async getSrs(): Promise<SrsResponse> {
      const client = await getClient();
      const id = await userId(client);
      const { data, error } = await client
        .from('srs_state')
        .select('item_key, box, due, seen, wrong, last')
        .eq('user_id', id);
      if (error) throw cloudError(error);
      return { items: rowsToItems(data as SrsRow[] | null) };
    },

    /**
     * Uploads changed items (same checks as PUT /api/srs): invalid items are dropped, the
     * `merge_srs` RPC merges per item and returns the full state.
     */
    async putSrs(items: ItemStates): Promise<SrsResponse> {
      if (!items || typeof items !== 'object' || Array.isArray(items)) {
        throw new ApiRequestError(400, 'invalid_srs', INVALID_SRS);
      }
      if (Object.keys(items).length > MAX_ITEMS_PER_REQUEST) {
        throw new ApiRequestError(413, 'too_many_items', 'יותר מדי פריטים בבקשה אחת');
      }
      const clean = sanitizeItemStates(items, Date.now(), MAX_ITEMS_PER_REQUEST) ?? {};
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('merge_srs', { items: clean });
      if (error) {
        if (/invalid_srs/.test(error.message ?? '')) throw new ApiRequestError(400, 'invalid_srs', INVALID_SRS);
        throw cloudError(error);
      }
      return { items: rowsToItems(data as SrsRow[] | null) };
    },

    /** Forgets the whole review state (progress reset); RLS lets learners delete their own rows. */
    async deleteSrs(): Promise<void> {
      const client = await getClient();
      const id = await userId(client);
      const { error } = await client.from('srs_state').delete().eq('user_id', id);
      if (error) throw cloudError(error);
    },

    async duels(): Promise<DuelsResponse> {
      return { duels: summarizeDuels(await myDuels(await getClient())) };
    },

    async createDuel(): Promise<DuelResponse> {
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('create_duel');
      if (error) throw duelError(error);
      return duelById(client, data as string);
    },

    async joinDuel(code: string): Promise<DuelResponse> {
      const clean = normalizeInviteCode(code);
      if (!clean) throw duelError({ message: 'invalid_code' });
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('join_duel', { code: clean });
      if (error) throw duelError(error);
      return duelById(client, data as string);
    },

    async cancelDuel(id: string): Promise<void> {
      const client = await getClient();
      await userId(client);
      const { error } = await client.rpc('cancel_duel', { did: id });
      if (error) throw duelError(error);
    },

    /** Shares the learner's pet with their groups (PUT /api/me/pet); RLS lets learners edit their own profile. */
    async setPet(pet: PetBadge | null): Promise<void> {
      const client = await getClient();
      const id = await userId(client);
      const { error } = await client
        .from('profiles')
        .update({ pet: pet && parsePetBadge(pet) })
        .eq('id', id);
      if (error) throw cloudError(error);
    },

    /** The personal league by period (GET /api/leaderboard?period=); without one, the last 7 days. */
    async leaderboard(period?: Period): Promise<LeaderboardResponse> {
      const client = await getClient();
      if (period) {
        const range = periodRange(period);
        const { data, error } = await client.rpc('xp_leaderboard', rangeArgs(range));
        if (error) throw cloudError(error);
        const rows = (data ?? []) as { rank: number; display_name: string; xp: number | string; is_me: boolean }[];
        return {
          entries: rows.map((r) => ({
            rank: r.rank,
            displayName: r.display_name,
            weeklyXp: Number(r.xp),
            isMe: r.is_me,
          })),
          endsAt: range.end,
        };
      }
      const { data, error } = await client.rpc('weekly_leaderboard');
      if (error) throw cloudError(error);
      const rows = (data ?? []) as { rank: number; display_name: string; weekly_xp: number; is_me: boolean }[];
      return {
        entries: rows.map((r) => ({
          rank: r.rank,
          displayName: r.display_name,
          weeklyXp: Number(r.weekly_xp),
          isMe: r.is_me,
        })),
      };
    },

    async groups(): Promise<GroupsResponse> {
      return myGroups(await getClient());
    },

    async createGroup(name: string): Promise<GroupResponse> {
      const clean = cleanGroupName(name);
      if (!clean) throw groupError({ message: 'invalid_name' });
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('create_group', { group_name: clean });
      if (error) throw groupError(error);
      return groupById(client, data as string);
    },

    async joinGroup(code: string): Promise<GroupResponse> {
      const clean = normalizeInviteCode(code);
      if (!clean) throw groupError({ message: 'invalid_code' });
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('join_group', { code: clean });
      if (error) throw groupError(error);
      return groupById(client, data as string);
    },

    async leaveGroup(id: string): Promise<void> {
      const client = await getClient();
      await userId(client);
      const { error } = await client.rpc('leave_group', { gid: id });
      if (error) throw groupError(error);
    },

    async groupMembers(id: string, period: Period): Promise<GroupMembersResponse> {
      const client = await getClient();
      await userId(client);
      const { data, error } = await client.rpc('group_member_stats', { gid: id, ...rangeArgs(periodRange(period)) });
      if (error) throw groupError(error);
      const rows = (data ?? []) as {
        display_name: string;
        xp: number | string;
        is_me: boolean;
        is_owner: boolean;
        joined_at: string;
        /** Missing before the pets update of schema.sql. */
        pet?: unknown;
      }[];
      return {
        members: rankMembers(
          rows.map((r) => ({
            displayName: r.display_name,
            xp: Number(r.xp),
            isMe: r.is_me,
            isOwner: r.is_owner,
            joinedAt: Date.parse(r.joined_at),
            pet: parsePetBadge(r.pet),
          })),
        ),
      };
    },

    async groupLeaderboard(period: Period): Promise<GroupLeaderboardResponse> {
      const client = await getClient();
      const range = periodRange(period);
      const previous = previousPeriodRange(period);
      const [current, before] = await Promise.all([
        groupTotals(client, range),
        previous ? groupTotals(client, previous) : Promise.resolve([]),
      ]);
      return {
        entries: rankGroups(current),
        endsAt: range.end,
        previousWinners: rankGroups(before, 3).slice(0, 3),
      };
    },
  };
}
