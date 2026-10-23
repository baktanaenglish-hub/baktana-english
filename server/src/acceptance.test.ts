/**
 * API checks for the acceptance criteria in docs/user-stories.md (sections 6–7)
 * that app.test.ts doesn't already cover, plus regression tests for bugs found in QA.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, Progress } from '../../shared/api';
import { allLessons } from '../../src/data/course';
import { dateKey, initialProgress, shiftDateKey } from '../../src/lib/progress';
import { createApp } from './app';
import { openDb } from './db';
import { plausibleLocalDate, sanitizeProgress } from './merge';

const [l1, l2] = allLessons.map((l) => l.id);
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp(openDb(':memory:'), { secret: 'test-secret', staticDir: false });
});

async function register(email = 'dana@example.com', displayName = 'דנה', password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const hebrew = /[֐-׿]/;

describe('US-A1 registration', () => {
  it('AC1: returns 201 with a token and the user; the token works for /me', async () => {
    const { token, user } = await register();
    expect(user).toMatchObject({ email: 'dana@example.com', displayName: 'דנה' });
    const me = await request(app).get('/api/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe('דנה');
  });

  it('AC3: missing fields, bad email and short password give 400 with a Hebrew message', async () => {
    const cases = [
      {},
      { email: 'dana@example.com', password: 'password123' },
      { email: 'not-an-email', password: 'password123', displayName: 'דנה' },
      { email: 'dana@example.com', password: '1234567', displayName: 'דנה' },
      { email: 'dana@example.com', password: 'password123', displayName: ' ' },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/auth/register').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.message).toMatch(hebrew);
    }
  });

  it('AC2/AC4: an existing email in any case gives 409 with a Hebrew message', async () => {
    await register('Dana@Mail.com');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dana@mail.com', password: 'password123', displayName: 'דנה 2' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(hebrew);
  });
});

describe('US-A2 login', () => {
  it('AC2: wrong password and unknown email give the same 401 body', async () => {
    await register();
    const wrong = await request(app).post('/api/auth/login').send({ email: 'dana@example.com', password: 'nope-nope' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('AC4: a malformed or foreign token gives 401 on /me', async () => {
    for (const token of ['garbage', 'a.b.c', `${(await register()).token}x`]) {
      expect((await request(app).get('/api/me').set(auth(token))).status).toBe(401);
    }
  });
});

describe('US-A3 / US-A4 sync', () => {
  const guest = (): Progress => ({
    ...initialProgress(),
    xp: 45,
    completed: { [l1]: 2, [l2]: 1 },
    streak: 1,
    lastActiveDate: dateKey(Date.now()),
    xpToday: 45,
  });

  it('US-A3 AC1/AC4: a guest upload is kept whole, and uploading it again changes nothing', async () => {
    const { token } = await register();
    const upload = guest();
    const first = await request(app).put('/api/progress').set(auth(token)).send(upload);
    expect(first.status).toBe(200);
    expect(first.body.progress).toMatchObject({ xp: 45, completed: { [l1]: 2, [l2]: 1 }, streak: 1 });
    const second = await request(app).put('/api/progress').set(auth(token)).send(upload);
    expect(second.body.progress).toEqual(first.body.progress);
    // The repeated upload doesn't count twice in the league either.
    const board = await request(app).get('/api/leaderboard').set(auth(token));
    expect(board.body.entries[0].weeklyXp).toBe(45);
  });

  it('US-A3 AC3: logging in on a new device merges both sides', async () => {
    const { token } = await register();
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 15, accuracy: 100 });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'password123' });
    const device: Progress = { ...initialProgress(), xp: 10, completed: { u1l1: 1, u1l2: 1 } };
    const res = await request(app).put('/api/progress').set(auth(login.body.token)).send(device);
    expect(res.body.progress.xp).toBe(15);
    expect(res.body.progress.completed).toEqual({ u1l1: 1, u1l2: 1 });
  });

  it('US-A4 AC3: a lesson finished on device A shows up on device B', async () => {
    const { token } = await register();
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 15, accuracy: 100 });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dana@example.com', password: 'password123' });
    const me = await request(app).get('/api/me').set(auth(login.body.token));
    expect(me.body.progress.completed).toEqual({ [l1]: 1 });
  });

  it('US-A4 AC4: every protected endpoint needs a bearer token', async () => {
    const calls = [
      request(app).get('/api/me'),
      request(app).get('/api/progress'),
      request(app).put('/api/progress').send(initialProgress()),
      request(app).post(`/api/lessons/${l1}/complete`).send({ xp: 10, accuracy: 100 }),
      request(app).get('/api/me').set('Authorization', 'Basic abc'),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(hebrew);
    }
  });
});

describe('US-B1 leaderboard', () => {
  it('AC1/AC4/AC5: guests get a sorted list with only rank, name and XP', async () => {
    const a = await register('a@example.com', 'אלון');
    const b = await register('b@example.com', 'בת');
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(a.token)).send({ xp: 10, accuracy: 90 });
    await request(app).post(`/api/lessons/${l1}/complete`).set(auth(b.token)).send({ xp: 15, accuracy: 100 });
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { displayName: string }) => e.displayName)).toEqual(['בת', 'אלון']);
    for (const entry of res.body.entries) {
      expect(Object.keys(entry).sort()).toEqual(['displayName', 'isMe', 'rank', 'weeklyXp']);
    }
    expect(JSON.stringify(res.body)).not.toContain('@example.com');
  });
});

describe('regression: streak dates follow the learner, not the server time zone', () => {
  it('uses the date the client reports for the lesson', async () => {
    const { token } = await register();
    const today = dateKey(Date.now());
    const yesterday = shiftDateKey(today, -1);
    const first = await request(app)
      .post(`/api/lessons/${l1}/complete`)
      .set(auth(token))
      .send({ xp: 15, accuracy: 100, date: yesterday });
    expect(first.body.progress).toMatchObject({ lastActiveDate: yesterday, streak: 1 });
    const second = await request(app)
      .post(`/api/lessons/${l2}/complete`)
      .set(auth(token))
      .send({ xp: 15, accuracy: 100, date: today });
    expect(second.body.progress).toMatchObject({ lastActiveDate: today, streak: 2 });
  });

  it('ignores implausible dates and falls back to the server date', async () => {
    const { token } = await register();
    for (const date of ['2001-01-01', '2999-01-01', 'yesterday', 42]) {
      const res = await request(app)
        .post(`/api/lessons/${l1}/complete`)
        .set(auth(token))
        .send({ xp: 10, accuracy: 100, date });
      expect(res.status).toBe(200);
      expect(res.body.progress.lastActiveDate).toBe(dateKey(Date.now()));
    }
  });

  it('plausibleLocalDate accepts only real dates within a day of the server date', () => {
    const now = new Date(2026, 9, 18, 12).getTime();
    expect(plausibleLocalDate('2026-10-17', now)).toBe('2026-10-17');
    expect(plausibleLocalDate('2026-10-19', now)).toBe('2026-10-19');
    expect(plausibleLocalDate('2026-10-20', now)).toBeNull();
    expect(plausibleLocalDate('2026-02-31', now)).toBeNull();
    expect(plausibleLocalDate(undefined, now)).toBeNull();
  });
});

describe('regression: a future lastActiveDate cannot freeze the streak', () => {
  it('sanitizeProgress drops the day fields of a future date', () => {
    const now = new Date(2026, 9, 18, 12).getTime();
    const p = sanitizeProgress(
      { ...initialProgress(now), xp: 40, lastActiveDate: '2030-01-01', streak: 900, xpToday: 40 },
      now,
    );
    expect(p).toMatchObject({ xp: 40, lastActiveDate: null, streak: 0, xpToday: 0 });
    const tomorrow = sanitizeProgress({ ...initialProgress(now), lastActiveDate: '2026-10-19', streak: 2 }, now);
    expect(tomorrow).toMatchObject({ lastActiveDate: '2026-10-19', streak: 2 });
  });

  it('a device with a wrong clock does not block later streak updates', async () => {
    const { token } = await register();
    await request(app)
      .put('/api/progress')
      .set(auth(token))
      .send({ ...initialProgress(), xp: 10, lastActiveDate: '2030-01-01', streak: 50, xpToday: 10 });
    const res = await request(app).post(`/api/lessons/${l1}/complete`).set(auth(token)).send({ xp: 10, accuracy: 100 });
    expect(res.body.progress).toMatchObject({ lastActiveDate: dateKey(Date.now()), streak: 1 });
    const again = await request(app)
      .put('/api/progress')
      .set(auth(token))
      .send({ ...res.body.progress });
    expect(again.body.progress.lastActiveDate).toBe(dateKey(Date.now()));
  });
});
