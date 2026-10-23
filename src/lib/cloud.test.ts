import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { allLessons } from '../data/course';
import { ApiRequestError } from './api-error';
import { cloudError, createCloudApi } from './cloud';
import { completeLesson, initialProgress, type Progress } from './progress';

/** In-memory stand-in for the parts of supabase-js that cloud.ts uses. */
function fakeSupabase(opts: { signedIn?: boolean; confirmEmail?: boolean; stored?: Progress } = {}) {
  const db = {
    progress: opts.stored ? [{ user_id: 'u1', data: opts.stored }] : ([] as { user_id: string; data: unknown }[]),
    xp_events: [] as { user_id: string; xp: number }[],
    profiles: [{ id: 'u1', display_name: 'דנה' }],
  };
  let session = opts.signedIn ? { user: { id: 'u1' } } : null;
  const signUps: { options?: { emailRedirectTo?: string } }[] = [];
  const rpcs: string[] = [];
  const user = { id: 'u1', email: 'dana@example.com', created_at: '2026-01-01T00:00:00Z', user_metadata: {} };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session ? user : null }, error: null }),
      signUp: async (req: { options?: { emailRedirectTo?: string } }) =>
        signUps.push(req) && opts.confirmEmail
          ? { data: { user: { ...user, identities: [{}] }, session: null }, error: null }
          : ((session = { user: { id: 'u1' } }), { data: { user, session }, error: null }),
      signInWithPassword: async ({ password }: { password: string }) =>
        password === 'correct-horse'
          ? ((session = { user: { id: 'u1' } }), { data: { user, session }, error: null })
          : { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } },
      signOut: async () => ((session = null), { error: null }),
    },
    from: (table: keyof typeof db) => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => ({
            data: (db[table] as Record<string, unknown>[]).find((r) => r.user_id === value || r.id === value) ?? null,
            error: null,
          }),
        }),
      }),
      upsert: async (row: { user_id: string; data: unknown }) => {
        db.progress = [...db.progress.filter((r) => r.user_id !== row.user_id), row];
        return { error: null };
      },
      insert: async (row: { user_id: string; xp: number }) => {
        db.xp_events.push(row);
        return { error: null };
      },
    }),
    rpc: async (name: string) => (
      rpcs.push(name),
      {
        data: [{ rank: 1, display_name: 'דנה', weekly_xp: '25', is_me: true }],
        error: null,
      }
    ),
  };
  return { db, signUps, rpcs, api: createCloudApi(async () => client as unknown as SupabaseClient) };
}

const [first, second] = allLessons;

describe('cloud backend', () => {
  it('registers and returns the display name from the profile', async () => {
    const { api } = fakeSupabase();
    const res = await api.register({ email: 'dana@example.com', password: 'correct-horse', displayName: 'דנה' });
    expect(res.user).toMatchObject({ id: 'u1', email: 'dana@example.com', displayName: 'דנה' });
  });

  it('asks to confirm the email when sign-up returns no session', async () => {
    const { api } = fakeSupabase({ confirmEmail: true });
    await expect(
      api.register({ email: 'a@b.co', password: 'correct-horse', displayName: 'דנה' }),
    ).rejects.toMatchObject({
      code: 'confirm_email',
    });
  });

  it('sends the confirmation link back to the public site', async () => {
    const { api, signUps } = fakeSupabase({ confirmEmail: true });
    await api.register({ email: 'a@b.co', password: 'correct-horse', displayName: 'דנה' }).catch(() => undefined);
    expect(signUps[0].options?.emailRedirectTo).toBe('https://baktanaenglish-hub.github.io/baktana-english/');
  });

  it('rejects a wrong password with a Hebrew 401', async () => {
    const { api } = fakeSupabase();
    const err = await api.login({ email: 'dana@example.com', password: 'nope' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/שגויים/);
  });

  it('deletes the account only after checking the password again', async () => {
    const { api, rpcs } = fakeSupabase({ signedIn: true });
    const err = await api.deleteAccount('nope').catch((e) => e);
    expect(err).toMatchObject({ status: 401, code: 'invalid_credentials', message: 'הסיסמה שגויה.' });
    expect(rpcs).toEqual([]);
    await api.deleteAccount('correct-horse');
    expect(rpcs).toEqual(['delete_my_account']);
    // Signed out locally afterwards.
    expect((await api.putProgress(initialProgress()).catch((e) => e)).unauthorized).toBe(true);
  });

  it('requires a session for progress calls', async () => {
    const { api } = fakeSupabase();
    const err = await api.putProgress(initialProgress()).catch((e) => e);
    expect(err.unauthorized).toBe(true);
  });

  it('merges uploaded progress and records the XP gained for the league', async () => {
    const { api, db } = fakeSupabase({ signedIn: true });
    const local = completeLesson(initialProgress(), first.id, 15);
    const res = await api.putProgress(local);
    expect(res.progress.completed[first.id]).toBe(1);
    expect(res.progress.xp).toBe(15);
    expect(db.xp_events).toEqual([{ user_id: 'u1', xp: 15 }]);
    // A second identical upload gains nothing.
    await api.putProgress(local);
    expect(db.xp_events).toHaveLength(1);
  });

  it('records a completed lesson and refuses a locked one', async () => {
    const { api, db } = fakeSupabase({ signedIn: true });
    await expect(api.completeLesson(second.id, { xp: 10, accuracy: 100 })).rejects.toMatchObject({
      code: 'lesson_locked',
    });
    const res = await api.completeLesson(first.id, { xp: 999, accuracy: 100 });
    expect(res.progress.completed[first.id]).toBe(1);
    // XP is clamped like the Express server does.
    expect(db.xp_events).toEqual([{ user_id: 'u1', xp: 50, lesson: true }]);
  });

  it('maps the leaderboard rows', async () => {
    const { api } = fakeSupabase({ signedIn: true });
    expect((await api.leaderboard()).entries).toEqual([{ rank: 1, displayName: 'דנה', weeklyXp: 25, isMe: true }]);
  });
});

describe('cloud groups', () => {
  /** A signed-in client whose RPCs answer from `answers` (an Error-like object fails the call). */
  function groupsApi(answers: Record<string, unknown>) {
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }) },
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        const answer = answers[name];
        return answer && typeof answer === 'object' && 'message' in answer
          ? { data: null, error: answer }
          : { data: answer ?? null, error: null };
      },
    };
    return { calls, api: createCloudApi(async () => client as unknown as SupabaseClient) };
  }

  const myGroup = {
    id: 'g1',
    name: 'המשפחה',
    invite_code: 'ABC234',
    member_count: 2,
    is_owner: true,
    joined_at: '2026-10-01T00:00:00Z',
    xp: '45',
    lessons: '3',
    active_days: '2',
  };
  const totals = [
    { id: 'g1', name: 'המשפחה', member_count: 2, total_xp: '45', is_mine: true },
    { id: 'g2', name: 'הכיתה', member_count: 10, total_xp: '600', is_mine: false },
  ];

  it('builds the group summaries with this week, rank and challenges', async () => {
    const { api, calls } = groupsApi({ my_groups: [myGroup], group_totals: totals });
    const [g] = (await api.groups()).groups;
    expect(g).toMatchObject({ id: 'g1', inviteCode: 'ABC234', weekXp: 45, weekScore: 15, weekRank: 2 });
    expect(g.challenges.find((c) => c.kind === 'lessons')?.progress).toBe(3);
    expect(calls[0].args).toEqual({ week_start: expect.any(String), week_end: expect.any(String) });
  });

  it('creates and joins after checking the input, and maps the errors to Hebrew', async () => {
    const { api, calls } = groupsApi({
      create_group: 'g1',
      join_group: { message: 'group_full' },
      my_groups: [myGroup],
      group_totals: totals,
    });
    await expect(api.createGroup(' x ')).rejects.toMatchObject({ code: 'invalid_name', status: 400 });
    expect((await api.createGroup('  המשפחה ')).group.id).toBe('g1');
    expect(calls.find((c) => c.name === 'create_group')?.args).toEqual({ group_name: 'המשפחה' });
    await expect(api.joinGroup('bad')).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(api.joinGroup('abc-234')).rejects.toMatchObject({
      code: 'group_full',
      status: 409,
      message: expect.stringContaining('הקבוצה מלאה'),
    });
    expect(calls.find((c) => c.name === 'join_group')?.args).toEqual({ code: 'ABC234' });
  });

  it('ranks the group board and last period winners, and the personal board by period', async () => {
    const { api, calls } = groupsApi({
      group_totals: totals,
      xp_leaderboard: [{ rank: 1, display_name: 'דנה', xp: '70', is_me: true }],
      group_member_stats: [
        { display_name: 'יוסי', xp: '5', is_me: false, is_owner: false, joined_at: '2026-10-02T00:00:00Z' },
        {
          display_name: 'דנה',
          xp: '40',
          is_me: true,
          is_owner: true,
          joined_at: '2026-10-01T00:00:00Z',
          pet: { name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: ['🧢', '🔪'] },
        },
      ],
    });
    const board = await api.groupLeaderboard('month');
    expect(board.entries.map((e) => [e.rank, e.name, e.score])).toEqual([
      [1, 'הכיתה', 60],
      [2, 'המשפחה', 15],
    ]);
    expect(board.previousWinners).toHaveLength(2);
    expect(board.endsAt).toEqual(expect.any(Number));
    const all = await api.groupLeaderboard('all');
    expect(all).toMatchObject({ endsAt: null, previousWinners: [] });
    expect(calls.filter((c) => c.name === 'group_totals').at(-1)?.args).toEqual({
      since: new Date(0).toISOString(),
      until: null,
    });

    expect((await api.leaderboard('week')).entries).toEqual([
      { rank: 1, displayName: 'דנה', weeklyXp: 70, isMe: true },
    ]);
    const members = await api.groupMembers('g1', 'week');
    expect(members.members.map((m) => m.displayName)).toEqual(['דנה', 'יוסי']);
    // A shared pet is checked on the way in; members without one have none.
    expect(members.members.map((m) => m.pet?.worn ?? null)).toEqual([['🧢'], null]);
  });

  it('lists, opens and joins duels, with their errors in Hebrew', async () => {
    const now = Date.now();
    const row = {
      id: 'd1',
      invite_code: 'ABC234',
      is_challenger: false,
      created_at: new Date(now - 60_000).toISOString(),
      starts_at: new Date(now - 30_000).toISOString(),
      my_name: 'יוסי',
      my_pet: null,
      my_xp: '25',
      opp_name: 'דנה',
      opp_pet: { name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: [] },
      opp_xp: '40',
    };
    const { api, calls } = groupsApi({ my_duels: [row], join_duel: 'd1', create_duel: { message: 'too_many_duels' } });
    expect((await api.duels()).duels[0]).toMatchObject({
      state: 'active',
      me: { displayName: 'יוסי', xp: 25, pet: null },
      opponent: { displayName: 'דנה', xp: 40, pet: { emoji: '🐲' } },
    });
    expect((await api.joinDuel(' abc-234 ')).duel.id).toBe('d1');
    expect(calls.find((c) => c.name === 'join_duel')?.args).toEqual({ code: 'ABC234' });
    await expect(api.createDuel()).rejects.toMatchObject({ status: 409, code: 'too_many_duels' });
    await expect(api.joinDuel('x')).rejects.toMatchObject({ code: 'invalid_code' });
  });
});

describe('cloudError', () => {
  it('treats network failures as offline', () => {
    expect(cloudError({ message: 'Failed to fetch' }).offline).toBe(true);
  });

  it('recognises a taken email', () => {
    expect(cloudError({ code: 'user_already_exists' }).status).toBe(409);
  });
});
