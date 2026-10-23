import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallTurnRequest } from '../../shared/call';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const req: CallTurnRequest = {
  persona: 'teacher',
  history: [{ role: 'assistant', text: 'Hi!' }],
  message: 'I go yesterday',
};
const ok = {
  reply: 'Oh, you went yesterday? Where?',
  replyHe: 'אה, הלכת אתמול? לאן?',
  corrections: [{ original: 'I go yesterday', corrected: 'I went yesterday', explanationHe: 'עבר' }],
};

const EXPRESS = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
const SUPABASE = { VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: 'anon' };

/** The Supabase session the mocked client returns (null = signed out). */
let session: { access_token: string } | null = null;

async function load(env: Record<string, string> = EXPRESS) {
  vi.resetModules();
  vi.doMock('./supabase', () => ({
    getSupabase: () => ({ auth: { getSession: async () => ({ data: { session }, error: null }) } }),
  }));
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./call-api');
}

const signedIn = () =>
  memoryStorage({ 'baktana-english:auth:v1': JSON.stringify({ token: 'tok', user: { id: '1' } }) });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('localStorage', signedIn());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  session = { access_token: 'user-jwt' };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock('./supabase');
});

describe('sendTurn', () => {
  it('POSTs the turn to the Express API with the learner’s token', async () => {
    const { sendTurn, CALLS_ENABLED } = await load();
    expect(CALLS_ENABLED).toBe(true);
    fetchMock.mockResolvedValue(json(200, ok));
    await expect(sendTurn(req)).resolves.toEqual(ok);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/call/turn');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(req);
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('refuses without calling when nobody is signed in (Express)', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const { sendTurn } = await load();
    await expect(sendTurn(req)).rejects.toMatchObject({ status: 401, code: 'unauthorized', unauthorized: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the Supabase Edge Function with the session’s access token', async () => {
    const { sendTurn, CALLS_ENABLED } = await load(SUPABASE);
    expect(CALLS_ENABLED).toBe(true);
    fetchMock.mockResolvedValue(json(200, ok));
    await sendTurn(req);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/functions/v1/call-turn');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('anon');
    expect(init.headers.Authorization).toBe('Bearer user-jwt');
  });

  it('refuses without calling when there is no Supabase session', async () => {
    session = null;
    const { sendTurn } = await load(SUPABASE);
    await expect(sendTurn(req)).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes on today’s call count', async () => {
    const { sendTurn } = await load();
    fetchMock.mockResolvedValue(json(200, { ...ok, callsToday: 3 }));
    await expect(sendTurn(req)).resolves.toMatchObject({ callsToday: 3 });
  });

  it('is disabled in a static build without a backend', async () => {
    const { CALLS_ENABLED } = await load({
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_ENABLE_ACCOUNTS: 'false',
    });
    expect(CALLS_ENABLED).toBe(false);
  });

  it('fills in optional fields and drops malformed corrections', async () => {
    const { sendTurn } = await load();
    fetchMock.mockResolvedValue(json(200, { reply: 'Hi', corrections: [{ original: 1 }], ended: true }));
    await expect(sendTurn(req)).resolves.toEqual({ reply: 'Hi', replyHe: '', corrections: [], ended: true });
  });

  it('throws the server’s Hebrew message', async () => {
    const { sendTurn } = await load();
    fetchMock.mockResolvedValue(json(429, { error: 'rate_limited', message: 'יותר מדי הודעות' }));
    await expect(sendTurn(req)).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      message: 'יותר מדי הודעות',
    });
  });

  it('treats network failures and gateway errors as offline', async () => {
    const { sendTurn, CALL_OFFLINE_MESSAGE } = await load();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(sendTurn(req)).rejects.toMatchObject({ offline: true, message: CALL_OFFLINE_MESSAGE });
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(sendTurn(req)).rejects.toMatchObject({ offline: true });
  });

  it('reports a timeout in Hebrew', async () => {
    const { sendTurn, CALL_TIMEOUT_MESSAGE } = await load();
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    await expect(sendTurn(req)).rejects.toMatchObject({ code: 'timeout', message: CALL_TIMEOUT_MESSAGE });
  });

  it('rejects a response without a reply', async () => {
    const { sendTurn } = await load();
    fetchMock.mockResolvedValue(json(200, { replyHe: 'x' }));
    await expect(sendTurn(req)).rejects.toMatchObject({ code: 'bad-response' });
  });

  it('maps 401, 403 and the daily limit to codes the screen can branch on', async () => {
    const { sendTurn, isCallBlocked, CALL_PREMIUM_MESSAGE, CALL_SIGNED_OUT_MESSAGE } = await load();
    fetchMock.mockResolvedValueOnce(json(429, { error: 'daily_limit', message: 'נגמרו השיחות להיום' }));
    const limit = await sendTurn(req).catch((e: unknown) => e);
    expect(limit).toMatchObject({ status: 429, code: 'daily_limit', message: 'נגמרו השיחות להיום' });
    expect(isCallBlocked(limit)).toBe(true);

    // Without our JSON body the Hebrew defaults are used.
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    const premium = await sendTurn(req).catch((e: unknown) => e);
    expect(premium).toMatchObject({ status: 403, code: 'premium_required', message: CALL_PREMIUM_MESSAGE });
    expect(isCallBlocked(premium)).toBe(true);

    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(sendTurn(req)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
      message: CALL_SIGNED_OUT_MESSAGE,
    });

    // A short-term rate limit is not the daily limit: the learner can retry.
    fetchMock.mockResolvedValueOnce(json(429, { error: 'rate_limited', message: 'לאט לאט' }));
    expect(isCallBlocked(await sendTurn(req).catch((e: unknown) => e))).toBe(false);
  });
});

describe('getCallStatus', () => {
  const status = { premium: true, callsToday: 2, callsPerDay: 10 };

  it('GETs /api/call/status with the learner’s token', async () => {
    const { getCallStatus } = await load();
    fetchMock.mockResolvedValue(json(200, status));
    await expect(getCallStatus()).resolves.toEqual(status);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/call/status');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('GETs the Edge Function in Supabase builds', async () => {
    const { getCallStatus } = await load(SUPABASE);
    fetchMock.mockResolvedValue(json(200, status));
    await getCallStatus();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/functions/v1/call-turn');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer user-jwt' });
  });

  it('is a 401 without a request when signed out', async () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const { getCallStatus } = await load();
    await expect(getCallStatus()).rejects.toMatchObject({ status: 401 });
    session = null;
    const supa = await load(SUPABASE);
    await expect(supa.getCallStatus()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes on a tester’s trial, but never for a premium learner', async () => {
    const { getCallStatus } = await load();
    fetchMock.mockResolvedValueOnce(json(200, { premium: false, tester: true, callsToday: 0, callsPerDay: 1 }));
    await expect(getCallStatus()).resolves.toEqual({ premium: false, tester: true, callsToday: 0, callsPerDay: 1 });
    fetchMock.mockResolvedValueOnce(json(200, { ...status, tester: true }));
    await expect(getCallStatus()).resolves.toEqual(status);
  });

  it('fills in a missing daily allowance and rejects malformed responses', async () => {
    const { getCallStatus } = await load();
    fetchMock.mockResolvedValueOnce(json(200, { premium: false }));
    await expect(getCallStatus()).resolves.toEqual({ premium: false, callsToday: 0, callsPerDay: 10 });
    fetchMock.mockResolvedValueOnce(json(200, { callsToday: 1 }));
    await expect(getCallStatus()).rejects.toMatchObject({ code: 'bad-response', offline: true });
  });

  it('passes on a subscription’s end and renewal, dropping malformed ones', async () => {
    const { getCallStatus } = await load(SUPABASE);
    const paid = { ...status, premiumUntil: '2026-11-21T12:00:00.000Z', willRenew: true };
    fetchMock.mockResolvedValueOnce(json(200, paid));
    await expect(getCallStatus()).resolves.toEqual(paid);
    fetchMock.mockResolvedValueOnce(json(200, { ...status, premiumUntil: 'soon', willRenew: 'yes' }));
    await expect(getCallStatus()).resolves.toEqual(status);
  });

  it('reports the server being unreachable as offline', async () => {
    const { getCallStatus } = await load();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(getCallStatus()).rejects.toMatchObject({ offline: true });
  });
});
