import { describe, expect, it } from 'vitest';
import { TOKEN_TTL_SECONDS, hashPassword, resolveSecret, signToken, verifyPassword, verifyToken } from './auth';

describe('passwords', () => {
  it('hashes with a per-user salt and verifies', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct horse');
    expect(await verifyPassword('correct horse', a)).toBe(true);
    expect(await verifyPassword('wrong horse', a)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('tokens', () => {
  const secret = 'test-secret';
  const now = Date.UTC(2026, 9, 18);

  it('round-trips the user id', () => {
    expect(verifyToken(signToken('user-1', secret, now), secret, now)).toBe('user-1');
  });

  it('rejects tampered, foreign and expired tokens', () => {
    const token = signToken('user-1', secret, now);
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'user-2', iat: 0, exp: 9e9 })).toString('base64url');
    expect(verifyToken(`${h}.${forged}.${s}`, secret, now)).toBeNull();
    expect(verifyToken(token, 'other-secret', now)).toBeNull();
    expect(verifyToken(token, secret, now + TOKEN_TTL_SECONDS * 1000)).toBeNull();
    expect(verifyToken(token, secret, now + (TOKEN_TTL_SECONDS - 60) * 1000)).toBe('user-1');
    expect(verifyToken('not.a.token', secret, now)).toBeNull();
    expect(verifyToken('abc', secret, now)).toBeNull();
  });
});

describe('resolveSecret', () => {
  it('uses JWT_SECRET, falls back in dev and refuses production without it', () => {
    expect(resolveSecret({ JWT_SECRET: 's3cret' })).toBe('s3cret');
    expect(resolveSecret({ NODE_ENV: 'test' })).toBeTypeOf('string');
    expect(() => resolveSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });
});
