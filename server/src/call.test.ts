import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '../../shared/api';
import { CALL_LIMITS, PERSONAS, TESTER_LIMITS, type CallMessage, type CallTurnRequest } from '../../shared/call';
import { usageDay } from '../../shared/premium';
import { createApp, type AppOptions } from './app';
import { openDb, type Db } from './db';
import { CALL_OUTPUT_SCHEMA, CALL_START } from './routes/call';

interface SentRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    max_tokens: number;
    system: string;
    output_config: { effort?: string; format?: { type: string; schema: unknown } };
    messages: { role: string; content: string }[];
  };
}

let sent: SentRequest[];
let db: Db;
let app: ReturnType<typeof createApp>;
/** Token of the signed-in learner used by turn(); premium unless a test signs in someone else. */
let token: string;

const PREMIUM = 'dana@example.com';
const PASSWORD = 'password123';

/** A fetch that records the request and answers like the Messages API with `text`. */
function fakeFetch(text: string | (() => Response | Promise<Response>)) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    });
    if (typeof text === 'function') return text();
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', role: 'assistant' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

async function register(email: string) {
  const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD, displayName: 'דנה' });
  expect(res.status).toBe(201);
  return res.body as AuthResponse;
}

/** A fresh app and database, with a premium learner (PREMIUM) signed in. */
async function setup(fetchImpl: typeof fetch, options: AppOptions = {}) {
  db = openDb(':memory:');
  app = createApp(db, {
    secret: 'test-secret',
    staticDir: false,
    anthropic: { apiKey: 'test-key', model: 'test-model', fetch: fetchImpl },
    premiumEmails: ` other@example.com, ${PREMIUM.toUpperCase()} `,
    ...options,
  });
  token = (await register(PREMIUM)).token;
}

const modelJson = (reply: string, corrections: unknown[] = []) =>
  JSON.stringify({ reply, replyHe: 'תרגום', corrections });

const greeting = (persona: CallTurnRequest['persona']): CallMessage => ({
  role: 'assistant',
  text: PERSONAS.find((p) => p.id === persona)!.greeting,
});

const turn = (body: unknown, as: string | null = token) => {
  const req = request(app).post('/api/call/turn');
  if (as) req.set('Authorization', `Bearer ${as}`);
  return req.send(body as object);
};

const status = (as: string = token) => request(app).get('/api/call/status').set('Authorization', `Bearer ${as}`);

const usageRows = () => db.prepare('SELECT user_id, day, calls, turns FROM call_usage').all();

const correction = { original: 'I goed to school', corrected: 'I went to school', explanationHe: 'went הוא עבר של go' };

beforeEach(() => {
  sent = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/call/turn', () => {
  it('returns the teacher reply with corrections', async () => {
    await setup(fakeFetch(modelJson('Oh, you went to school! What did you learn?', [correction])));
    const res = await turn({ persona: 'teacher', history: [greeting('teacher')], message: 'I goed to school' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reply: 'Oh, you went to school! What did you learn?',
      replyHe: 'תרגום',
      corrections: [correction],
      callsToday: 1,
    });
    expect(res.headers['cache-control']).toBe('no-store');

    expect(sent).toHaveLength(1);
    const [req] = sent;
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('test-key');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
    expect(req.body.model).toBe('test-model');
    expect(req.body.max_tokens).toBeGreaterThan(0);
    expect(req.body.system).toContain('Emma');
    expect(req.body.output_config.format).toEqual({ type: 'json_schema', schema: CALL_OUTPUT_SCHEMA });
    expect(CALL_OUTPUT_SCHEMA.required).toEqual(['reply', 'replyHe', 'corrections']);
  });

  it('strips corrections for characters that do not correct', async () => {
    await setup(fakeFetch(modelJson('Cool! What did you do there?', [correction])));
    const res = await turn({ persona: 'friend', history: [greeting('friend')], message: 'I goed to school' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Cool! What did you do there?');
    expect(res.body.corrections).toEqual([]);
  });

  it('sends messages that start with user and alternate', async () => {
    await setup(fakeFetch(modelJson('Nice!')));
    const history: CallMessage[] = [
      greeting('barista'),
      { role: 'user', text: 'Hi' },
      { role: 'user', text: 'A latte please' },
      { role: 'assistant', text: 'Small or large?' },
    ];
    const res = await turn({ persona: 'barista', history, message: 'Large' });
    expect(res.status).toBe(200);
    const roles = sent[0].body.messages.map((m) => m.role);
    expect(roles[0]).toBe('user');
    expect(roles.at(-1)).toBe('user');
    roles.forEach((role, i) => i > 0 && expect(role).not.toBe(roles[i - 1]));
    expect(sent[0].body.messages[0].content).toBe(CALL_START);
    expect(sent[0].body.messages.at(-1)!.content).toBe('Large');
    expect(sent[0].body.messages.map((m) => m.content).join('\n')).toContain('Hi\nA latte please');
  });

  it('does not call the model for a flagged message', async () => {
    const fetchImpl = fakeFetch(modelJson('should not be used'));
    await setup(fetchImpl);
    const res = await turn({
      persona: 'friend',
      history: [greeting('friend')],
      message: 'My phone number is 052-123-4567',
    });
    expect(res.status).toBe(200);
    expect(res.body.flagged).toEqual(expect.any(String));
    expect(res.body.reply).toEqual(expect.any(String));
    expect(res.body.corrections).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('says goodbye without calling the model after the turn limit', async () => {
    const fetchImpl = fakeFetch(modelJson('should not be used'));
    await setup(fetchImpl);
    const history: CallMessage[] = [greeting('teacher')];
    for (let i = 0; i < CALL_LIMITS.maxTurns; i++) {
      history.push({ role: 'user', text: `Sentence ${i}` }, { role: 'assistant', text: 'Nice!' });
    }
    const res = await turn({ persona: 'teacher', history, message: 'One more' });
    expect(res.status).toBe(200);
    expect(res.body.ended).toBe(true);
    expect(res.body.reply).toEqual(expect.any(String));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('replaces an unsafe model reply with a safe one', async () => {
    await setup(fakeFetch(modelJson("Cool! What's your phone number?")));
    const res = await turn({ persona: 'friend', history: [greeting('friend')], message: 'I like music' });
    expect(res.status).toBe(200);
    expect(res.body.reply).not.toMatch(/phone number\?/);
    expect(res.body.corrections).toEqual([]);
  });

  it('falls back to a generic reply when the model output is not JSON', async () => {
    await setup(fakeFetch('not json at all'));
    const res = await turn({ persona: 'teacher', history: [greeting('teacher')], message: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/again/i);
    expect(res.body.corrections).toEqual([]);
  });

  it('answers 503 when no API key is configured', async () => {
    const fetchImpl = fakeFetch(modelJson('x'));
    await setup(fetchImpl, { anthropic: { apiKey: '', fetch: fetchImpl } });
    const res = await turn({ persona: 'teacher', history: [greeting('teacher')], message: 'Hello' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'call_unavailable', message: 'שיחות הווידאו לא זמינות כרגע' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', () => new Response('{"type":"error"}', { status: 529 })],
    [
      'a network error',
      () => {
        throw new TypeError('fetch failed');
      },
    ],
  ])('answers 502 on %s from Anthropic', async (_name, respond) => {
    await setup(fakeFetch(respond));
    const res = await turn({ persona: 'teacher', history: [greeting('teacher')], message: 'Hello' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('call_failed');
    expect(res.body.message).toMatch(/[֐-׿]/);
  });

  it.each([
    [{}],
    [{ persona: 'pirate', history: [], message: 'Hello' }],
    [{ persona: 'teacher', history: [], message: '' }],
    [{ persona: 'teacher', history: [], message: 'x'.repeat(CALL_LIMITS.maxMessageChars + 1) }],
    [{ persona: 'teacher', history: [], message: 42 }],
    [[{ persona: 'teacher', history: [], message: 'Hello' }]],
  ])('rejects an invalid body %#', async (body) => {
    const fetchImpl = fakeFetch(modelJson('x'));
    await setup(fetchImpl);
    const res = await turn(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_call');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rate limits per IP', async () => {
    await setup(fakeFetch(modelJson('Hi!')), { callRateLimit: { max: 2, windowMs: 60_000 } });
    const body = { persona: 'friend', history: [greeting('friend')], message: 'Hello' };
    expect((await turn(body)).status).toBe(200);
    expect((await turn(body)).status).toBe(200);
    expect((await turn(body)).status).toBe(429);
  });
});

describe('call access and daily limits', () => {
  const start = (persona: CallTurnRequest['persona'] = 'friend') => ({
    persona,
    history: [greeting(persona)],
    message: 'Hello',
  });
  const cont = (persona: CallTurnRequest['persona'] = 'friend') => ({
    persona,
    history: [greeting(persona), { role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi!' }],
    message: 'How are you?',
  });

  it('answers 401 without a valid token and does not call the model', async () => {
    const fetchImpl = fakeFetch(modelJson('x'));
    await setup(fetchImpl);
    for (const as of [null, 'not-a-token']) {
      const res = await turn(start(), as);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthorized');
    }
    expect((await request(app).get('/api/call/status')).status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(usageRows()).toEqual([]);
  });

  it('answers 403 premium_required for a signed-in learner who is not premium', async () => {
    const fetchImpl = fakeFetch(modelJson('x'));
    await setup(fetchImpl);
    const other = (await register('noa@example.com')).token;
    const res = await turn(start(), other);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'premium_required', message: 'שיחות וידאו זמינות כרגע רק למנויי פרימיום' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(usageRows()).toEqual([]);
  });

  it('treats everyone as non-premium when PREMIUM_EMAILS is empty', async () => {
    await setup(fakeFetch(modelJson('x')), { premiumEmails: '' });
    expect((await turn(start())).status).toBe(403);
    expect((await status()).body).toEqual({ premium: false, callsToday: 0, callsPerDay: CALL_LIMITS.callsPerDay });
  });

  it('allows 10 calls a day and refuses the 11th with 429 daily_limit', async () => {
    const fetchImpl = fakeFetch(modelJson('Hi!'));
    await setup(fetchImpl, { callRateLimit: { max: 100, windowMs: 60_000 } });
    for (let i = 1; i <= CALL_LIMITS.callsPerDay; i++) {
      const res = await turn(start());
      expect(res.status).toBe(200);
      expect(res.body.callsToday).toBe(i);
    }
    const res = await turn(start('teacher'));
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'daily_limit', message: 'הגעתם למגבלה של 10 שיחות ביום. נתראה מחר!' });
    expect(fetchImpl).toHaveBeenCalledTimes(CALL_LIMITS.callsPerDay);

    // A call already in progress may go on.
    const more = await turn(cont());
    expect(more.status).toBe(200);
    expect(more.body.callsToday).toBe(CALL_LIMITS.callsPerDay);
  });

  it('counts continuing turns as turns but not as new calls', async () => {
    await setup(fakeFetch(modelJson('Nice!')));
    expect((await turn(start())).body.callsToday).toBe(1);
    for (let i = 0; i < 3; i++) {
      const res = await turn(cont());
      expect(res.status).toBe(200);
      expect(res.body.callsToday).toBe(1);
    }
    expect(usageRows()).toEqual([{ user_id: expect.any(String), day: usageDay(), calls: 1, turns: 4 }]);
  });

  it('counts flagged turns but not invalid requests or 503s', async () => {
    const fetchImpl = fakeFetch(modelJson('x'));
    await setup(fetchImpl);
    const flagged = await turn({ ...start(), message: 'My phone number is 052-123-4567' });
    expect(flagged.status).toBe(200);
    expect(flagged.body.flagged).toEqual(expect.any(String));
    expect(flagged.body.callsToday).toBe(1);
    expect((await turn({ persona: 'pirate', history: [], message: 'Hi' })).status).toBe(400);
    expect(usageRows()).toEqual([expect.objectContaining({ calls: 1, turns: 1 })]);

    await setup(fetchImpl, { anthropic: { apiKey: '', fetch: fetchImpl } });
    expect((await turn(start())).status).toBe(503);
    expect(usageRows()).toEqual([]);
  });

  it('caps the turns per day across calls', async () => {
    const fetchImpl = fakeFetch(modelJson('Hi!'));
    await setup(fetchImpl);
    const me = (await status()).body;
    expect(me.premium).toBe(true);
    const userId = (db.prepare('SELECT id FROM users WHERE email = ?').get(PREMIUM) as { id: string }).id;
    db.prepare('INSERT INTO call_usage (user_id, day, calls, turns) VALUES (?, ?, 2, ?)').run(
      userId,
      usageDay(),
      CALL_LIMITS.turnsPerDay - 1,
    );
    expect((await turn(cont())).status).toBe(200);
    const res = await turn(cont());
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('daily_limit');
    expect(res.body.message).toMatch(/[֐-׿]/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Yesterday's usage doesn't count today.
    db.prepare('UPDATE call_usage SET day = ?').run('2000-01-01');
    expect((await turn(cont())).status).toBe(200);
  });

  it('reports the status of premium and non-premium learners', async () => {
    await setup(fakeFetch(modelJson('Hi!')));
    expect((await status()).body).toEqual({ premium: true, callsToday: 0, callsPerDay: CALL_LIMITS.callsPerDay });
    await turn(start());
    await turn(cont());
    await turn(start());
    const res = await status();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ premium: true, callsToday: 2, callsPerDay: CALL_LIMITS.callsPerDay });

    const other = (await register('noa@example.com')).token;
    expect((await status(other)).body).toEqual({ premium: false, callsToday: 0, callsPerDay: CALL_LIMITS.callsPerDay });
  });

  it('deletes the usage rows with the account', async () => {
    await setup(fakeFetch(modelJson('Hi!')));
    await turn(start());
    expect(usageRows()).toHaveLength(1);
    const res = await request(app)
      .delete('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD });
    expect(res.status).toBe(204);
    expect(usageRows()).toEqual([]);
  });
});

describe('testers', () => {
  const TESTER = 'tester@example.com';
  const call = (sentences: number, persona: CallTurnRequest['persona'] = 'friend') => {
    const history: CallMessage[] = [greeting(persona)];
    for (let i = 0; i < sentences; i++) {
      history.push({ role: 'user', text: `Sentence ${i}` }, { role: 'assistant', text: 'Nice!' });
    }
    return { persona, history, message: 'One more' };
  };

  async function asTester(options: AppOptions = {}) {
    await setup(fakeFetch(modelJson('Hi!')), { testerEmails: ` ${TESTER.toUpperCase()} `, ...options });
    return (await register(TESTER)).token;
  }

  it('reports a tester as not premium, with one call a day', async () => {
    const tester = await asTester();
    expect((await status(tester)).body).toEqual({
      premium: false,
      tester: true,
      callsToday: 0,
      callsPerDay: TESTER_LIMITS.callsPerDay,
    });
    // Premium wins over the tester list.
    expect((await status()).body).toEqual({ premium: true, callsToday: 0, callsPerDay: CALL_LIMITS.callsPerDay });
  });

  it('allows one call a day and refuses a second', async () => {
    const tester = await asTester();
    const first = await turn(call(0), tester);
    expect(first.status).toBe(200);
    expect(first.body.callsToday).toBe(1);
    expect((await turn(call(1), tester)).status).toBe(200);
    const second = await turn(call(0, 'teacher'), tester);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'daily_limit', message: 'השיחה של היום כבר נוצלה. נתראה מחר!' });
  });

  it('answers ten sentences, then the character says goodbye', async () => {
    const tester = await asTester();
    const tenth = await turn(call(TESTER_LIMITS.maxTurns - 1), tester);
    expect(tenth.body.ended).toBeUndefined();
    const eleventh = await turn(call(TESTER_LIMITS.maxTurns), tester);
    expect(eleventh.status).toBe(200);
    expect(eleventh.body.ended).toBe(true);
    // A premium learner's call goes on past ten sentences.
    expect((await turn(call(TESTER_LIMITS.maxTurns))).body.ended).toBeUndefined();
  });

  it('keeps everyone else out', async () => {
    await asTester();
    const other = (await register('noa@example.com')).token;
    expect((await turn(call(0), other)).status).toBe(403);
    expect((await status(other)).body.tester).toBeUndefined();
  });
});
