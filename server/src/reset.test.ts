import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, Progress } from '../../shared/api';
import { completeLesson, initialProgress, resetProgress } from '../../src/lib/progress';
import { createApp } from './app';
import { openDb } from './db';

/** Progress reset while signed in (US-A5): the newer reset wins over every older copy. */

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(openDb(':memory:'), { secret: 'test-secret', staticDir: false });
});

async function register() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'dana@example.com', password: 'password123', displayName: 'דנה' });
  return (res.body as AuthResponse).token;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const put = (token: string, progress: Progress) => request(app).put('/api/progress').set(auth(token)).send(progress);

describe('progress reset on the server', () => {
  it('replaces the stored progress, and a stale device cannot bring it back', async () => {
    const token = await register();
    const before = completeLesson(completeLesson(initialProgress(), 'u1l1', 15), 'u1l2', 10);
    await put(token, before);

    const fresh = resetProgress(before);
    const afterReset = await put(token, fresh);
    expect(afterReset.body.progress.completed).toEqual({});
    expect(afterReset.body.progress.xp).toBe(0);
    expect(afterReset.body.progress.resetAt).toBe(fresh.resetAt);

    // Another device still holds the old progress (no resetAt) and syncs.
    const stale = await put(token, before);
    expect(stale.body.progress.completed).toEqual({});
    expect(stale.body.progress.xp).toBe(0);

    // Lessons after the reset still count.
    const next = await put(token, completeLesson(afterReset.body.progress, 'u1l1', 10));
    expect(next.body.progress.completed).toEqual({ u1l1: 1 });
  });

  it('DELETE /api/srs forgets the review state', async () => {
    const token = await register();
    const item = { box: 2, due: '2026-01-01', seen: 1, wrong: 0, last: 100 };
    await request(app)
      .put('/api/srs')
      .set(auth(token))
      .send({ items: { 'w:cat': item } });
    expect((await request(app).delete('/api/srs').set(auth(token))).status).toBe(204);
    expect((await request(app).get('/api/srs').set(auth(token))).body).toEqual({ items: {} });
    expect((await request(app).delete('/api/srs')).status).toBe(401);
  });
});
