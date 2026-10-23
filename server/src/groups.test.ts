import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, GroupSummary } from '../../shared/api';
import { MAX_GROUP_MEMBERS, MAX_GROUPS_PER_USER, periodRange } from '../../shared/groups';
import { allLessons } from '../../src/data/course';
import { createApp } from './app';
import { openDb, type Db } from './db';

const [l1, l2] = allLessons.map((l) => l.id);

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db, { secret: 'test-secret', staticDir: false });
});

let users = 0;
async function register(displayName: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `user${++users}@example.com`, password: 'password123', displayName });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createGroup(token: string, name = 'המשפחה') {
  const res = await request(app).post('/api/groups').set(auth(token)).send({ name });
  expect(res.status).toBe(201);
  return res.body.group as GroupSummary;
}

async function join(token: string, code: string) {
  return request(app).post('/api/groups/join').set(auth(token)).send({ code });
}

const lesson = (token: string, id = l1, xp = 10) =>
  request(app).post(`/api/lessons/${id}/complete`).set(auth(token)).send({ xp, accuracy: 100 });

/** XP from before the period starts (and before anyone joined). */
function oldXp(userId: string, xp: number) {
  db.prepare('INSERT INTO xp_events (user_id, xp, created_at) VALUES (?, ?, ?)').run(userId, xp, 1000);
}

describe('groups', () => {
  it('creates a group with an invite code, and friends join with it (any case, with spaces)', async () => {
    const dana = await register('דנה');
    const group = await createGroup(dana.token, '  כיתה   ג׳ ');
    expect(group).toMatchObject({ name: 'כיתה ג׳', memberCount: 1, isOwner: true, weekXp: 0, weekRank: null });
    expect(group.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(group.challenges.map((c) => c.kind)).toEqual(['xp', 'lessons', 'days']);

    const yossi = await register('יוסי');
    const res = await join(yossi.token, ` ${group.inviteCode.slice(0, 3).toLowerCase()} ${group.inviteCode.slice(3)}`);
    expect(res.status).toBe(200);
    expect(res.body.group).toMatchObject({ id: group.id, memberCount: 2, isOwner: false });

    expect((await join(yossi.token, group.inviteCode)).body.error).toBe('already_member');
    expect((await join(yossi.token, 'ZZZZZZ')).status).toBe(404);
    expect((await join(yossi.token, 'nope')).body.error).toBe('invalid_code');
  });

  it('validates the name and needs a signed-in learner', async () => {
    const dana = await register('דנה');
    for (const name of ['', 'א', 'x'.repeat(31), 42]) {
      const res = await request(app).post('/api/groups').set(auth(dana.token)).send({ name });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_name');
    }
    expect((await request(app).get('/api/groups')).status).toBe(401);
    expect((await request(app).post('/api/groups').send({ name: 'קבוצה' })).status).toBe(401);
  });

  it('limits groups per learner and members per group', async () => {
    const dana = await register('דנה');
    for (let i = 0; i < MAX_GROUPS_PER_USER; i++) await createGroup(dana.token, `קבוצה ${i}`);
    const res = await request(app).post('/api/groups').set(auth(dana.token)).send({ name: 'עוד אחת' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('too_many_groups');

    const owner = await register('בעלים');
    const group = await createGroup(owner.token);
    for (let i = 1; i < MAX_GROUP_MEMBERS; i++) {
      const insert = db.prepare(
        "INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, 'x', 'x', '')",
      );
      insert.run(`m${i}`, `m${i}@example.com`);
      db.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').run(group.id, `m${i}`, 1);
    }
    const late = await register('מאחר');
    expect((await join(late.token, group.inviteCode)).body.error).toBe('group_full');
  });

  it("counts members' XP from when they joined, and tracks the weekly challenges", async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    oldXp(dana.user.id, 500);
    const group = await createGroup(dana.token);
    await join(yossi.token, group.inviteCode);
    await lesson(dana.token, l1, 15);
    await lesson(dana.token, l2, 10);
    await lesson(yossi.token, l1, 10);

    const res = await request(app).get('/api/groups').set(auth(yossi.token));
    expect(res.status).toBe(200);
    const [mine] = res.body.groups as GroupSummary[];
    expect(mine).toMatchObject({ id: group.id, weekXp: 35, weekScore: 12, weekRank: 1 });
    expect(mine.weekStart).toBe(periodRange('week').start);
    const byKind = Object.fromEntries(mine.challenges.map((c) => [c.kind, c]));
    expect(byKind.lessons.progress).toBe(3);
    // Two members learned today: two member-days.
    expect(byKind.days.progress).toBe(2);
    expect(byKind.xp).toMatchObject({ progress: 35, done: false });

    const members = await request(app).get(`/api/groups/${group.id}/members?period=all`).set(auth(yossi.token));
    expect(members.body.members).toEqual([
      { rank: 1, displayName: 'דנה', xp: 25, isMe: false, isOwner: true },
      { rank: 2, displayName: 'יוסי', xp: 10, isMe: true, isOwner: false },
    ]);
  });

  it('shows a group board to its members only', async () => {
    const dana = await register('דנה');
    const stranger = await register('זר');
    const group = await createGroup(dana.token);
    const res = await request(app).get(`/api/groups/${group.id}/members`).set(auth(stranger.token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_member');
    const bad = await request(app).get(`/api/groups/${group.id}/members?period=year`).set(auth(dana.token));
    expect(bad.body.error).toBe('invalid_period');
  });

  it('passes ownership on when the owner leaves, and removes an empty group', async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    const group = await createGroup(dana.token);
    await join(yossi.token, group.inviteCode);

    expect((await request(app).delete(`/api/groups/${group.id}/membership`).set(auth(dana.token))).status).toBe(204);
    const left = await request(app).delete(`/api/groups/${group.id}/membership`).set(auth(dana.token));
    expect(left.status).toBe(404);
    const [yossiGroup] = (await request(app).get('/api/groups').set(auth(yossi.token))).body.groups;
    expect(yossiGroup).toMatchObject({ memberCount: 1, isOwner: true });

    await request(app).delete(`/api/groups/${group.id}/membership`).set(auth(yossi.token));
    expect(db.prepare('SELECT COUNT(*) AS n FROM groups').get()).toEqual({ n: 0 });
  });

  it('cleans up groups when an account is deleted', async () => {
    const dana = await register('דנה');
    await createGroup(dana.token);
    const res = await request(app).delete('/api/me').set(auth(dana.token)).send({ password: 'password123' });
    expect(res.status).toBe(204);
    expect(db.prepare('SELECT COUNT(*) AS n FROM groups').get()).toEqual({ n: 0 });
  });
});

describe('GET /api/groups/leaderboard', () => {
  it('ranks groups by average XP per member, so a bigger group does not win on size alone', async () => {
    const [a, b, c, d] = await Promise.all(['אבי', 'בני', 'גיל', 'דור'].map((n) => register(n)));
    const big = await createGroup(a.token, 'הגדולה');
    await join(b.token, big.inviteCode);
    await join(c.token, big.inviteCode);
    await join(d.token, big.inviteCode);
    const small = await register('הדס');
    const smallGroup = await createGroup(small.token, 'הקטנה');
    const solo = await register('ורד');
    await createGroup(solo.token, 'לבד');

    // The big group: 4 members × 10 XP = 40 → 10 per member.
    for (const u of [a, b, c, d]) await lesson(u.token);
    // The small group: one member, 15 XP → counted as 3 members → 5.
    await lesson(small.token, l1, 15);
    // A solo learner with 2 lessons: 25 XP / 3 → 8.
    await lesson(solo.token, l1, 15);
    await lesson(solo.token, l2, 10);

    const res = await request(app).get('/api/groups/leaderboard?period=week').set(auth(small.token));
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([
      { rank: 1, name: 'הגדולה', memberCount: 4, totalXp: 40, score: 10, isMine: false },
      { rank: 2, name: 'לבד', memberCount: 1, totalXp: 25, score: 8, isMine: false },
      { rank: 3, name: 'הקטנה', memberCount: 1, totalXp: 15, score: 5, isMine: true },
    ]);
    expect(res.body.endsAt).toBe(periodRange('week').end);
    expect(res.body.previousWinners).toEqual([]);
    expect(smallGroup.weekRank).toBeNull();

    // Guests can look too; all time has no end and no previous winners.
    const all = await request(app).get('/api/groups/leaderboard?period=all');
    expect(all.body).toMatchObject({ endsAt: null, previousWinners: [] });
    expect(all.body.entries.every((e: { isMine: boolean }) => !e.isMine)).toBe(true);
  });
});

describe('GET /api/leaderboard?period=', () => {
  it('ranks by calendar period and keeps the old rolling week without a period', async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    await lesson(dana.token, l1, 10);
    await lesson(yossi.token, l1, 15);
    oldXp(dana.user.id, 500);

    const week = await request(app).get('/api/leaderboard?period=week').set(auth(dana.token));
    expect(week.body.entries).toEqual([
      { rank: 1, displayName: 'יוסי', weeklyXp: 15, isMe: false },
      { rank: 2, displayName: 'דנה', weeklyXp: 10, isMe: true },
    ]);
    expect(week.body.endsAt).toBe(periodRange('week').end);

    const all = await request(app).get('/api/leaderboard?period=all').set(auth(dana.token));
    expect(all.body.entries[0]).toEqual({ rank: 1, displayName: 'דנה', weeklyXp: 510, isMe: true });
    expect(all.body.endsAt).toBeNull();

    const legacy = await request(app).get('/api/leaderboard');
    expect(legacy.body).toEqual({ entries: expect.any(Array) });
    expect((await request(app).get('/api/leaderboard?period=year')).status).toBe(400);
  });

  it("adds the caller's own row below the top 20", async () => {
    const insertUser = db.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, 'x', '')",
    );
    for (let i = 0; i < 25; i++) {
      insertUser.run(`u${i}`, `u${i}@example.com`, `User ${i}`);
      db.prepare('INSERT INTO xp_events (user_id, xp, created_at) VALUES (?, ?, ?)').run(`u${i}`, 100 + i, Date.now());
    }
    const me = await register('אני');
    await lesson(me.token, l1, 10);
    const res = await request(app).get('/api/leaderboard?period=month').set(auth(me.token));
    expect(res.body.entries).toHaveLength(21);
    expect(res.body.entries[20]).toEqual({ rank: 26, displayName: 'אני', weeklyXp: 10, isMe: true });
  });
});

describe('pets in groups', () => {
  const badge = { name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: ['🧢'] };

  it("shows each member's shared pet on the group board", async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    const group = await createGroup(dana.token);
    expect((await join(yossi.token, group.inviteCode)).status).toBe(200);

    expect((await request(app).put('/api/me/pet').set(auth(dana.token)).send({ pet: badge })).status).toBe(204);
    const res = await request(app).get(`/api/groups/${group.id}/members?period=all`).set(auth(yossi.token));
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.members.map((m: { displayName: string }) => [m.displayName, m]));
    expect(byName['דנה'].pet).toEqual(badge);
    expect(byName['יוסי'].pet).toBeUndefined();

    // null stops sharing.
    expect((await request(app).put('/api/me/pet').set(auth(dana.token)).send({ pet: null })).status).toBe(204);
    const after = await request(app).get(`/api/groups/${group.id}/members?period=all`).set(auth(yossi.token));
    expect(after.body.members.every((m: { pet?: unknown }) => m.pet === undefined)).toBe(true);
  });

  it('needs sign-in and a valid badge', async () => {
    expect((await request(app).put('/api/me/pet').send({ pet: badge })).status).toBe(401);
    const dana = await register('דנה');
    const res = await request(app)
      .put('/api/me/pet')
      .set(auth(dana.token))
      .send({ pet: { ...badge, emoji: '💣' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_pet');
  });
});
