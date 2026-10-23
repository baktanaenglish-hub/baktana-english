import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, OFFLINE_MESSAGE, api, clearAuth, loadAuth, saveAuth } from './api';

/** Minimal in-memory localStorage for the node test environment. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const user = { id: '1', email: 'a@b.co', displayName: 'רון', createdAt: '2026-01-01' };

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stores and clears auth', () => {
    expect(loadAuth()).toBeNull();
    saveAuth({ token: 't', user });
    expect(loadAuth()?.user.displayName).toBe('רון');
    clearAuth();
    expect(loadAuth()).toBeNull();
  });

  it('logs in with a JSON POST to a relative URL', async () => {
    fetchMock.mockResolvedValue(json(200, { token: 'abc', user }));
    const res = await api.login({ email: 'a@b.co', password: 'secret' });
    expect(res.token).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'secret' });
  });

  it('sends the bearer token on authenticated calls', async () => {
    saveAuth({ token: 'tok', user });
    fetchMock.mockResolvedValue(json(200, { progress: {} }));
    await api.completeLesson('u1l1', { xp: 15, accuracy: 100 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lessons/u1l1/complete');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('refuses authenticated calls without a token, without hitting the network', async () => {
    await expect(api.getProgress()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws the Hebrew server message', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'email_taken', message: 'האימייל כבר רשום' }));
    const error = await api.register({ email: 'a@b.co', password: '123456', displayName: 'רון' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toBe('האימייל כבר רשום');
    expect(error.status).toBe(409);
    expect(error.code).toBe('email_taken');
  });

  it('treats network failures and non-JSON gateway errors as offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.health()).rejects.toMatchObject({ status: 0, message: OFFLINE_MESSAGE });
    fetchMock.mockResolvedValueOnce(new Response('<html>proxy error</html>', { status: 502 }));
    await expect(api.leaderboard()).rejects.toMatchObject({ offline: true });
  });
});
