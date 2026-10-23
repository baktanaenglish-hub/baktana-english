import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, ItemState, Progress, SrsResponse } from '../../shared/api';
import { dateKey, initialProgress, shiftDateKey } from '../../src/lib/progress';
import { createApp, type AppOptions } from './app';
import { migrate, openDb, type Db } from './db';

/** Server side of docs/spec/v2.md: unlock rule (US-U1), SRS sync (US-R6), events (US-T1). */

const SECRET = 'test-secret';
let db: Db;
let app: ReturnType<typeof createApp>;

function setup(options: AppOptions = {}) {
  db = openDb(':memory:');
  app = createApp(db, { secret: SECRET, staticDir: false, ...options });
}

async function register(email = 'dana@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', displayName: 'דנה' });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const TODAY = dateKey(Date.now());
const st = (over: Partial<ItemState> = {}): ItemState => ({
  box: 2,
  due: TODAY,
  seen: 3,
  wrong: 1,
  last: 100,
  ...over,
});

beforeEach(() => setup());

describe('migrations', () => {
  it('creates srs_state, events, call_usage, groups, the pet column and duels (user_version 7) and is idempotent', () => {
    const fresh = openDb(':memory:');
    expect((fresh.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(7);
    const tables = fresh.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['srs_state', 'events', 'call_usage', 'groups', 'group_members']),
    );
    // Running again is a no-op.
    migrate(fresh);
    expect((fresh.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(7);
  });

  it('applies #2 to #7 to a v1 database without touching existing rows', () => {
    const old = openDb(':memory:');
    old.exec(
      `DROP TABLE duels; ALTER TABLE users DROP COLUMN pet;
       DROP TABLE group_members; DROP TABLE groups; DROP INDEX xp_events_user_created;
       ALTER TABLE xp_events DROP COLUMN lesson;
       DROP TABLE call_usage; DROP TABLE events; DROP TABLE srs_state; PRAGMA user_version = 1`,
    );
    old.prepare("INSERT INTO users VALUES ('u1', 'a@b.co', 'דנה', 'x', '2026-01-01')").run();
    migrate(old);
    expect((old.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(7);
    expect(old.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
    old.prepare("INSERT INTO srs_state VALUES ('u1', 'w:cat', 1, '2026-01-02', 1, 0, 0)").run();
    old.prepare("INSERT INTO call_usage VALUES ('u1', '2026-01-02', 1, 1)").run();
    expect(old.prepare('SELECT pet FROM users').get()).toEqual({ pet: null });
  });
});

describe('US-U1 AC6: unlock rule on the server', () => {
  it('a learner who finished u2l1 before the release may complete the new u1l4', async () => {
    const { token, user } = await register();
    const old: Progress = { ...initialProgress(), completed: { u1l1: 1, u1l2: 1, u1l3: 1, u2l1: 1 } };
    db.prepare('UPDATE progress SET json = ? WHERE user_id = ?').run(JSON.stringify(old), user.id);
    const res = await request(app).post('/api/lessons/u1l4/complete').set(auth(token)).send({ xp: 10, accuracy: 90 });
    expect(res.status).toBe(200);
    expect(res.body.progress.completed.u1l4).toBe(1);
  });

  it('still locks lessons ahead of the learner', async () => {
    const { token } = await register();
    const res = await request(app).post('/api/lessons/u1l3/complete').set(auth(token)).send({ xp: 10, accuracy: 90 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('lesson_locked');
  });

  it('PUT /api/progress keeps lesson ids of newer clients and drops junk', async () => {
    const { token } = await register();
    const body = { ...initialProgress(), completed: { u1l1: 1, u13l1: 1, u12cp: 1, 'bad id': 1, __practice__: 2 } };
    const res = await request(app).put('/api/progress').set(auth(token)).send(body);
    expect(res.status).toBe(200);
    expect(res.body.progress.completed).toEqual({ u1l1: 1, u13l1: 1, u12cp: 1 });
    // An older client uploading without u13l1 does not remove it.
    const again = await request(app)
      .put('/api/progress')
      .set(auth(token))
      .send({ ...initialProgress(), completed: { u1l1: 1 } });
    expect(again.body.progress.completed).toEqual({ u1l1: 1, u13l1: 1, u12cp: 1 });
  });
});

describe('GET/PUT /api/srs (US-R6)', () => {
  it('AC4: requires a token', async () => {
    expect((await request(app).get('/api/srs')).status).toBe(401);
    const res = await request(app).put('/api/srs').send({ items: {} });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/[֐-׿]/);
  });

  it('starts empty and stores an upload', async () => {
    const { token } = await register();
    expect((await request(app).get('/api/srs').set(auth(token))).body).toEqual({ items: {} });
    const put = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st(), 's:u1l1:0': st({ box: 0 }) } });
    expect(put.status).toBe(200);
    expect(put.body).toEqual<SrsResponse>({ items: { 'w:cat': st(), 's:u1l1:0': st({ box: 0 }) } });
    expect((await request(app).get('/api/srs').set(auth(token))).body).toEqual(put.body);
  });

  it('AC1: two devices converge on the newer state', async () => {
    const { token } = await register();
    // Device B (older answer, higher box) syncs first, then device A.
    await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st({ box: 3, last: 100 }) } });
    const a = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st({ box: 1, last: 200 }) } });
    expect(a.body.items['w:cat']).toMatchObject({ box: 1, last: 200 });
    // B syncs again with its stale copy: the newer state stays.
    const b = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st({ box: 3, last: 100 }) } });
    expect(b.body.items['w:cat']).toMatchObject({ box: 1, last: 200 });
  });

  it('AC2: equal last keeps the lower box and the maximum seen/wrong', async () => {
    const { token } = await register();
    await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st({ box: 4, seen: 9, wrong: 1 }) } });
    const res = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': st({ box: 2, seen: 5, wrong: 3 }) } });
    expect(res.body.items['w:cat']).toEqual(st({ box: 2, seen: 9, wrong: 3 }));
  });

  it('AC3: drops invalid items; a body that is not an object is a 400', async () => {
    const { token } = await register();
    const res = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({
        items: {
          'w:ok': st(),
          'not a key': st(),
          'w:box7': st({ box: 7 as ItemState['box'] }),
          'w:later': st({ due: shiftDateKey(TODAY, 730) }),
        },
      });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.items)).toEqual(['w:ok']);
    for (const body of [[1, 2], { items: [st()] }, { items: 'x' }, {}]) {
      const bad = await request(app).put('/api/srs').set(auth(token)).send(body);
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('invalid_srs');
    }
  });

  it('rejects more than 1000 items in one request with 413', async () => {
    const { token } = await register();
    const items: Record<string, ItemState> = {};
    for (let i = 0; i < 1001; i++) items[`w:w${i}`] = st();
    const res = await request(app).put('/api/srs').set(auth(token)).send({ items });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('too_many_items');
  });

  it('stops adding new items at 3000 per learner', async () => {
    const { token, user } = await register();
    const insert = db.prepare('INSERT INTO srs_state VALUES (?, ?, 1, ?, 1, 0, 0)');
    for (let i = 0; i < 2999; i++) insert.run(user.id, `w:x${String(i).padStart(4, '0')}`, TODAY);
    const res = await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:new-b': st(), 'w:new-a': st(), 'w:x0000': st({ last: 5 }) } });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.items)).toHaveLength(3000);
    expect(res.body.items['w:new-a']).toBeDefined();
    expect(res.body.items['w:new-b']).toBeUndefined();
    expect(res.body.items['w:x0000'].last).toBe(5);
  });

  it('AC4: learners never see each other’s state', async () => {
    const dana = await register('dana@example.com');
    const noa = await register('noa@example.com');
    await request(app)
      .put('/api/srs')
      .set(auth(dana.token))
      .send({ items: { 'w:cat': st() } });
    expect((await request(app).get('/api/srs').set(auth(noa.token))).body).toEqual({ items: {} });
    const res = await request(app)
      .put('/api/srs')
      .set(auth(noa.token))
      .send({ items: { 'w:dog': st() } });
    expect(Object.keys(res.body.items)).toEqual(['w:dog']);
  });
});

describe('POST /api/events (US-T1 AC5)', () => {
  const ANON = '3f2b8c1e-7d4a-4c2b-9e1f-0a1b2c3d4e5f';
  const event = (over: Record<string, unknown> = {}) => ({
    name: 'lesson_complete',
    anonId: ANON,
    ts: Date.now(),
    localDate: TODAY,
    localHour: 9,
    appVersion: '0.2.0',
    platform: 'web',
    lessonId: 'u1l1',
    durationMs: 61_000,
    props: { accuracy: 90, mistakes: 1 },
    ...over,
  });
  const rows = () => db.prepare('SELECT * FROM events ORDER BY id').all() as Record<string, unknown>[];

  it('stores a guest event with user_id null and responds 204', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ events: [event()] });
    expect(res.status).toBe(204);
    const [row] = rows();
    expect(row).toMatchObject({
      anon_id: ANON,
      user_id: null,
      name: 'lesson_complete',
      lesson_id: 'u1l1',
      duration_ms: 61_000,
      local_date: TODAY,
      local_hour: 9,
      platform: 'web',
      app_version: '0.2.0',
      correct: null,
    });
    expect(JSON.parse(String(row.props))).toEqual({ accuracy: 90, mistakes: 1 });
  });

  it('takes user_id from the token, never from the body', async () => {
    const { token, user } = await register();
    const res = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send({
        events: [
          event({ name: 'exercise_answer', userId: 'someone-else', user_id: 'x', correct: false, firstTry: true }),
        ],
      });
    expect(res.status).toBe(204);
    expect(rows()[0]).toMatchObject({ user_id: user.id, correct: 0, first_try: 1 });
  });

  it('treats an invalid token as a guest', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(auth('garbage'))
      .send({ events: [event()] });
    expect(res.status).toBe(204);
    expect(rows()[0].user_id).toBeNull();
  });

  it('drops invalid events and keeps the valid ones (at most 50)', async () => {
    const batch = [
      event(),
      event({ name: 'nope' }),
      event({ anonId: 'not-a-uuid' }),
      ...Array.from({ length: 60 }, () => event()),
    ];
    const res = await request(app).post('/api/events').send({ events: batch });
    expect(res.status).toBe(204);
    expect(rows()).toHaveLength(48);
  });

  it('is a 400 when no valid event is left', async () => {
    for (const body of [
      { events: [event({ name: 'nope' })] },
      { events: [event({ anonId: 'x' })] },
      { events: [] },
      {},
      [],
    ]) {
      const res = await request(app).post('/api/events').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_events');
    }
    expect(rows()).toHaveLength(0);
  });

  it('is rate limited per IP', async () => {
    setup({ eventsRateLimit: { max: 2, windowMs: 60_000 } });
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(app)
            .post('/api/events')
            .send({ events: [event()] })
        ).status,
      ).toBe(204);
    const res = await request(app)
      .post('/api/events')
      .send({ events: [event()] });
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
