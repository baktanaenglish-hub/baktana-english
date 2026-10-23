import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '../../shared/api';
import { PET_DESIGNS_PER_DAY } from '../../shared/pet-design';
import { createApp } from './app';
import { openDb } from './db';

const DESIGN = { name: 'זוהר', base: '🦊', color: 'lilac', traits: ['stars'], personality: 'funny', bio: 'שועל קטן' };

let app: ReturnType<typeof createApp>;
let sent: { body: { system: string; messages: { content: string }[]; output_config: unknown } }[];

function fakeFetch(text = JSON.stringify(DESIGN)) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push({ body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

async function signUp(email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', displayName: 'דנה' });
  return (res.body as AuthResponse).token;
}

function setup(fetchImpl = fakeFetch(), apiKey = 'test-key') {
  sent = [];
  app = createApp(openDb(':memory:'), {
    secret: 'test-secret',
    staticDir: false,
    anthropic: { apiKey, model: 'test-model', fetch: fetchImpl },
    premiumEmails: 'dana@example.com',
    callRateLimit: { max: 1000, windowMs: 60_000 },
  });
}

describe('POST /api/pet/design', () => {
  beforeEach(() => setup());

  it('designs a pet for a premium learner', async () => {
    const token = await signUp('dana@example.com');
    const res = await request(app)
      .post('/api/pet/design')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'שועל סגול עם כוכבים' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DESIGN);
    expect(sent[0].body.messages[0].content).toContain('שועל סגול עם כוכבים');
    expect(sent[0].body.output_config).toMatchObject({ format: { type: 'json_schema' } });
  });

  it('needs sign-in and premium', async () => {
    expect((await request(app).post('/api/pet/design').send({ prompt: 'x' })).status).toBe(401);
    const token = await signUp('other@example.com');
    const res = await request(app)
      .post('/api/pet/design')
      .set('Authorization', `Bearer ${token}`)
      .send({ prompt: 'x' });
    expect(res.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it('rejects an empty or inappropriate wish without calling the model', async () => {
    const token = await signUp('dana@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/pet/design').set(auth).send({ prompt: ' ' })).status).toBe(400);
    expect((await request(app).post('/api/pet/design').set(auth).send({ prompt: 'a sexy cat' })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it('answers 502 when the model output is unusable, and 503 without a key', async () => {
    setup(fakeFetch('not json'));
    let token = await signUp('dana@example.com');
    let res = await request(app).post('/api/pet/design').set('Authorization', `Bearer ${token}`).send({ prompt: 'x' });
    expect(res.status).toBe(502);
    setup(fakeFetch(), '');
    token = await signUp('dana@example.com');
    res = await request(app).post('/api/pet/design').set('Authorization', `Bearer ${token}`).send({ prompt: 'x' });
    expect(res.status).toBe(503);
  });

  it('limits designs per day', async () => {
    const token = await signUp('dana@example.com');
    const auth = { Authorization: `Bearer ${token}` };
    for (let i = 0; i < PET_DESIGNS_PER_DAY; i++) {
      expect((await request(app).post('/api/pet/design').set(auth).send({ prompt: 'x' })).status).toBe(200);
    }
    const res = await request(app).post('/api/pet/design').set(auth).send({ prompt: 'x' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('daily_limit');
  });
});
