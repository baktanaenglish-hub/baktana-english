import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, DuelSummary } from '../../shared/api';
import { DUEL_INVITE_MS, DUEL_MS, MAX_OPEN_DUELS } from '../../shared/duels';
import { allLessons } from '../../src/data/course';
import { createApp } from './app';
import { openDb, type Db } from './db';

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
    .send({ email: `duel${++users}@example.com`, password: 'password123', displayName });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const open = async (token: string) => request(app).post('/api/duels').set(auth(token)).send();
const join = (token: string, code: string) => request(app).post('/api/duels/join').set(auth(token)).send({ code });
const list = async (token: string) =>
  (await request(app).get('/api/duels').set(auth(token))).body.duels as DuelSummary[];
const lesson = (token: string, xp: number) =>
  request(app).post(`/api/lessons/${allLessons[0].id}/complete`).set(auth(token)).send({ xp, accuracy: 100 });

describe('duels', () => {
  it('opens a duel with an invite code; a friend accepts it and their XP since the start counts', async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    await lesson(yossi.token, 15); // before the duel: never counts
    const created = await open(dana.token);
    expect(created.status).toBe(201);
    const waiting = created.body.duel as DuelSummary;
    expect(waiting).toMatchObject({ state: 'waiting', isChallenger: true, opponent: null, startsAt: null });
    expect(waiting.inviteCode).toMatch(/^[A-Z2-9]{6}$/);

    const accepted = await join(yossi.token, waiting.inviteCode.toLowerCase());
    expect(accepted.status).toBe(200);
    expect(accepted.body.duel).toMatchObject({
      state: 'active',
      isChallenger: false,
      me: { displayName: 'יוסי', xp: 0 },
      opponent: { displayName: 'דנה', xp: 0 },
    });

    await lesson(dana.token, 10);
    await lesson(yossi.token, 15);
    await lesson(yossi.token, 10);
    const [mine] = await list(dana.token);
    expect(mine).toMatchObject({ state: 'active', me: { xp: 10 }, opponent: { xp: 25 }, result: null });
    expect(mine.endsAt - mine.startsAt!).toBe(DUEL_MS);
  });

  it('ends after a week with a result for each side', async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    const code = (await open(dana.token)).body.duel.inviteCode;
    await join(yossi.token, code);
    await lesson(dana.token, 15);
    // Move the duel a week into the past, with its XP.
    db.prepare('UPDATE duels SET starts_at = starts_at - ?').run(DUEL_MS);
    db.prepare('UPDATE xp_events SET created_at = created_at - ?').run(DUEL_MS);
    expect((await list(dana.token))[0]).toMatchObject({ state: 'finished', result: 'won' });
    expect((await list(yossi.token))[0]).toMatchObject({ state: 'finished', result: 'lost' });
  });

  it("can't be accepted twice, by its own challenger, or after the invite expired", async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    const rina = await register('רינה');
    const code = (await open(dana.token)).body.duel.inviteCode;
    expect((await join(dana.token, code)).body.error).toBe('own_duel');
    expect((await join(yossi.token, code)).status).toBe(200);
    expect((await join(rina.token, code)).body.error).toBe('duel_not_found');
    expect((await join(rina.token, 'nope')).body.error).toBe('invalid_code');

    const late = (await open(dana.token)).body.duel.inviteCode;
    db.prepare('UPDATE duels SET created_at = created_at - ? WHERE invite_code = ?').run(DUEL_INVITE_MS, late);
    expect((await join(rina.token, late)).status).toBe(404);
  });

  it('limits open duels and lets the challenger withdraw an invite', async () => {
    const dana = await register('דנה');
    const ids: string[] = [];
    for (let i = 0; i < MAX_OPEN_DUELS; i++) ids.push((await open(dana.token)).body.duel.id);
    const over = await open(dana.token);
    expect(over.status).toBe(409);
    expect(over.body.error).toBe('too_many_duels');

    const yossi = await register('יוסי');
    expect((await request(app).delete(`/api/duels/${ids[0]}`).set(auth(yossi.token))).status).toBe(404);
    expect((await request(app).delete(`/api/duels/${ids[0]}`).set(auth(dana.token))).status).toBe(204);
    expect(await list(dana.token)).toHaveLength(MAX_OPEN_DUELS - 1);
    expect((await open(dana.token)).status).toBe(201);
  });

  it('needs sign-in', async () => {
    expect((await request(app).get('/api/duels')).status).toBe(401);
    expect((await request(app).post('/api/duels')).status).toBe(401);
  });

  it("shows the friend's pet", async () => {
    const dana = await register('דנה');
    const yossi = await register('יוסי');
    const pet = { name: 'פיצי', emoji: '🦄', stage: 2, color: '#e2559b', worn: [] };
    await request(app).put('/api/me/pet').set(auth(yossi.token)).send({ pet });
    await join(yossi.token, (await open(dana.token)).body.duel.inviteCode);
    expect((await list(dana.token))[0].opponent?.pet).toEqual(pet);
  });
});
