import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, Progress } from '../../shared/api';
import { allLessons } from '../../src/data/course';
import { initialProgress } from '../../src/lib/progress';
import { createApp, type AppOptions } from './app';
import { signToken } from './auth';
import { openDb, type Db } from './db';

const SECRET = 'test-secret';
const [l1, l2, l3] = allLessons.map((l) => l.id);

let db: Db;
let app: ReturnType<typeof createApp>;

function setup(options: AppOptions = {}) {
  db = openDb(':memory:');
  app = createApp(db, { secret: SECRET, staticDir: false, ...options });
}

async function register(email = 'dana@example.com', displayName = 'דנה', password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => setup());

describe('GET /api/health', () => {
  it('reports ok with a version and sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, version: expect.any(String) });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns ApiError JSON for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'not_found', message: expect.any(String) });
  });
});

describe('POST /api/auth/register', () => {
  it('creates a user with lowercase email and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: '  Dana@Example.COM ', password: 'password123', displayName: ' דנה ' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'dana@example.com',
      displayName: 'דנה',
      createdAt: expect.any(String),
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it.each([
    [{ email: 'bad', password: 'password123', displayName: 'דנה' }, 'invalid_email'],
    [{ email: 'a@b.co', password: 'short', displayName: 'דנה' }, 'weak_password'],
    [{ email: 'a@b.co', password: 'password123', displayName: 'ד' }, 'invalid_display_name'],
    [{ email: 'a@b.co', password: 'password123', displayName: 'x'.repeat(31) }, 'invalid_display_name'],
    [{}, 'invalid_email'],
  ])('validates input %#', async (body, error) => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(res.body.message).toMatch(/[֐-׿]/);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await register('dana@example.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'DANA@example.com', password: 'password123', displayName: 'דנה 2' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('rejects malformed JSON with an ApiError', async () => {
    const res = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{oops');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password (email case-insensitive)', async () => {
    const { user } = await register();
    const res = await request(app).post('/api/auth/login').send({ email: 'DANA@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
    const me = await request(app).get('/api/me').set(auth(res.body.token));
    expect(me.status).toBe(200);
  });

  it('rejects a wrong password and unknown emails the same way', async () => {
    await register();
    const wrong = await request(app).post('/api/auth/login').send({ email: 'dana@example.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'who@example.com', password: 'password123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    const missing = await request(app).post('/api/auth/login').send({});
    expect(missing.status).toBe(400);
  });

  it('rate-limits repeated attempts', async () => {
    setup({ authRateLimit: { max: 3, windowMs: 60_000 } });
    const attempt = () => request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'password123' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('GET /api/me', () => {
  it('returns the user and fresh progress', async () => {
    const { token, user } = await register();
    const res = await request(app).get('/api/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
    expect(res.body.progress).toMatchObject({ xp: 0, completed: {}, streak: 0, hearts: 5 });
  });

  it.each([
    ['no header', {}],
    ['garbage token', auth('garbage')],
    ['wrong secret', auth(signToken('someone', 'other-secret'))],
    ['unknown user', auth(signToken('ghost', SECRET))],
    ['expired', auth(signToken('ghost', SECRET, Date.now() - 31 * 24 * 3600 * 1000))],
  ])('rejects %s with 401', async (_name, headers) => {
    const res = await request(app).get('/api/me').set(headers);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('rejects an expired token for a real user', async () => {
    const { user } = await register();
    const old = signToken(user.id, SECRET, Date.now() - 31 * 24 * 3600 * 1000);
    expect((await request(app).get('/api/me').set(auth(old))).status).toBe(401);
  });
});

describe('DELETE /api/me', () => {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

  it('deletes the account and everything stored with it', async () => {
    const { token, user } = await register();
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 10, accuracy: 90 });
    db.prepare(`INSERT INTO srs_state VALUES (?, 'w:cat', 1, '2026-01-01', 1, 0, 1)`).run(user.id);
    db.prepare(
      `INSERT INTO events (anon_id, user_id, name, props, client_ts, local_date, local_hour, created_at)
       VALUES ('a', ?, 'app_open', '{}', 1, '2026-01-01', 9, 1)`,
    ).run(user.id);

    const res = await request(app).delete('/api/me').set(auth(token)).send({ password: 'password123' });
    expect(res.status).toBe(204);
    for (const table of ['users', 'progress', 'xp_events', 'srs_state', 'events']) expect(count(table)).toBe(0);
    expect((await request(app).get('/api/me').set(auth(token))).status).toBe(401);
    expect((await request(app).get('/api/leaderboard')).body.entries).toEqual([]);
    // The address is free again.
    await register();
  });

  it('asks for the right password', async () => {
    const { token } = await register();
    const missing = await request(app).delete('/api/me').set(auth(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('missing_password');
    const wrong = await request(app).delete('/api/me').set(auth(token)).send({ password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe('invalid_credentials');
    expect(count('users')).toBe(1);
  });

  it('requires auth', async () => {
    expect((await request(app).delete('/api/me').send({ password: 'password123' })).status).toBe(401);
  });
});

describe('progress endpoints', () => {
  it('require auth', async () => {
    expect((await request(app).get('/api/progress')).status).toBe(401);
    expect((await request(app).put('/api/progress').send(initialProgress())).status).toBe(401);
    expect((await request(app).post(`/api/lessons/${l1}/complete`).send({ xp: 10, accuracy: 100 })).status).toBe(401);
  });

  it('GET returns stored progress', async () => {
    const { token } = await register();
    const res = await request(app).get('/api/progress').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.progress.xp).toBe(0);
  });

  it('PUT merges guest progress into the account and persists it', async () => {
    const { token } = await register();
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 10, accuracy: 90 });
    const guest: Progress = {
      ...initialProgress(),
      xp: 45,
      completed: { [l1]: 2, [l2]: 1, unknownLesson: 3 },
      streak: 1,
      lastActiveDate: '2020-01-01',
      xpToday: 0,
    };
    const res = await request(app).put('/api/progress').set(auth(token)).send(guest);
    expect(res.status).toBe(200);
    expect(res.body.progress).toMatchObject({ xp: 45, completed: { [l1]: 2, [l2]: 1 }, streak: 1 });
    expect(res.body.progress.lastActiveDate).not.toBe('2020-01-01');
    expect(res.body.progress.completed.unknownLesson).toBeUndefined();

    const again = await request(app).get('/api/progress').set(auth(token));
    expect(again.body.progress).toEqual(res.body.progress);
  });

  it('PUT accepts the optional client-only dailyGoal field', async () => {
    const { token } = await register();
    const res = await request(app)
      .put('/api/progress')
      .set(auth(token))
      .send({ ...initialProgress(), dailyGoal: 30 });
    expect(res.status).toBe(200);
  });

  it('PUT counts XP gained on the device towards the league, capped per sync', async () => {
    const { token } = await register();
    await request(app).put('/api/progress').set(auth(token)).send({ ...initialProgress(), xp: 15 });
    let board = await request(app).get('/api/leaderboard').set(auth(token));
    expect(board.body.entries).toEqual([{ rank: 1, displayName: 'דנה', weeklyXp: 15, isMe: true }]);

    // Re-uploading the same progress adds nothing; a huge jump is capped.
    await request(app).put('/api/progress').set(auth(token)).send({ ...initialProgress(), xp: 15 });
    await request(app).put('/api/progress').set(auth(token)).send({ ...initialProgress(), xp: 5000 });
    board = await request(app).get('/api/leaderboard').set(auth(token));
    expect(board.body.entries[0].weeklyXp).toBe(65);
  });

  it('PUT rejects malformed progress', async () => {
    const { token } = await register();
    const res = await request(app).put('/api/progress').set(auth(token)).send({ xp: 'lots' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_progress');
  });
});

describe('POST /api/lessons/:lessonId/complete', () => {
  it('completes an unlocked lesson, updates progress and unlocks the next one', async () => {
    const { token } = await register();
    const res = await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 15, accuracy: 100 });
    expect(res.status).toBe(200);
    expect(res.body.progress).toMatchObject({ xp: 15, xpToday: 15, streak: 1, completed: { [l1]: 1 } });

    const next = await request(app).post(`/api/lessons/${l2}/complete`).set(auth(token)).send({ xp: 10, accuracy: 80 });
    expect(next.status).toBe(200);
    expect(next.body.progress).toMatchObject({ xp: 25, completed: { [l1]: 1, [l2]: 1 }, streak: 1 });
  });

  it('rejects locked lessons', async () => {
    const { token } = await register();
    const res = await request(app).post(`/api/lessons/${l3}/complete`).set(auth(token)).send({ xp: 10, accuracy: 100 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('lesson_locked');
  });

  it('rejects unknown lessons', async () => {
    const { token } = await register();
    const res = await request(app).post('/api/lessons/nope/complete').set(auth(token)).send({ xp: 10, accuracy: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('lesson_not_found');
  });

  it('clamps xp to 0–50 and validates the body', async () => {
    const { token } = await register();
    const big = await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 9999, accuracy: 100 });
    expect(big.body.progress.xp).toBe(50);
    const negative = await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: -20, accuracy: 100 });
    expect(negative.body.progress.xp).toBe(50);
    expect(negative.body.progress.completed[l1]).toBe(2);

    for (const body of [{}, { xp: '10', accuracy: 100 }, { xp: 10, accuracy: 101 }, { xp: 10 }]) {
      const res = await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send(body);
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /api/leaderboard', () => {
  it('ranks users by XP earned in the last 7 days and marks the caller', async () => {
    const dana = await register('dana@example.com', 'דנה');
    const yossi = await register('yossi@example.com', 'יוסי');
    await register('noa@example.com', 'נועה');

    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(dana.token)).send({ xp: 10, accuracy: 100 });
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(yossi.token)).send({ xp: 15, accuracy: 100 });
    await request(app).post(`/api/lessons/${l2}/complete`).set(auth(yossi.token)).send({ xp: 15, accuracy: 100 });
    // Old XP doesn't count towards this week.
    db.prepare('INSERT INTO xp_events (user_id, xp, created_at) VALUES (?, ?, ?)').run(
      dana.user.id,
      500,
      Date.now() - 8 * 24 * 3600 * 1000,
    );

    const res = await request(app).get('/api/leaderboard').set(auth(dana.token));
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([
      { rank: 1, displayName: 'יוסי', weeklyXp: 30, isMe: false },
      { rank: 2, displayName: 'דנה', weeklyXp: 10, isMe: true },
    ]);

    const guest = await request(app).get('/api/leaderboard');
    expect(guest.status).toBe(200);
    expect(guest.body.entries.every((e: { isMe: boolean }) => !e.isMe)).toBe(true);

    // An invalid token is treated as a guest, not rejected.
    expect((await request(app).get('/api/leaderboard').set(auth('garbage'))).status).toBe(200);
  });

  it('returns at most 20 entries', async () => {
    const insertUser = db.prepare(
      "INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, 'x', '')",
    );
    const insertXp = db.prepare('INSERT INTO xp_events (user_id, xp, created_at) VALUES (?, ?, ?)');
    for (let i = 0; i < 25; i++) {
      insertUser.run(`u${i}`, `u${i}@example.com`, `User ${i}`);
      insertXp.run(`u${i}`, i + 1, Date.now());
    }
    const res = await request(app).get('/api/leaderboard');
    expect(res.body.entries).toHaveLength(20);
    expect(res.body.entries[0]).toMatchObject({ rank: 1, weeklyXp: 25 });
  });
});

describe('static web app', () => {
  it('serves files and falls back to index.html outside /api', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'baktana-dist-'));
    writeFileSync(join(dir, 'index.html'), '<html>app</html>');
    writeFileSync(join(dir, 'app.js'), 'console.log(1)');
    setup({ staticDir: dir });
    expect((await request(app).get('/app.js')).text).toContain('console.log');
    const spa = await request(app).get('/profile/stats');
    expect(spa.status).toBe(200);
    expect(spa.text).toContain('app');
    expect((await request(app).get('/api/missing')).status).toBe(404);
  });

  it('never lets the app shell or service worker go stale, but caches hashed assets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'baktana-dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<html>app</html>');
    writeFileSync(join(dir, 'sw.js'), '// sw');
    writeFileSync(join(dir, 'assets', 'index-abc123.js'), '// bundle');
    setup({ staticDir: dir });
    expect((await request(app).get('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await request(app).get('/index.html')).headers['cache-control']).toBe('no-cache');
    expect((await request(app).get('/')).headers['cache-control']).toBe('no-cache');
    expect((await request(app).get('/assets/index-abc123.js')).headers['cache-control']).toContain('immutable');
  });
});

describe('dev CORS', () => {
  it('allows localhost origins only', async () => {
    setup({ cors: true });
    const ok = await request(app).options('/api/progress').set('Origin', 'http://localhost:5173');
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
