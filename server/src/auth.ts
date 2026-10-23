import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';
import { HttpError, unauthorized } from './errors';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Hash format: `scrypt$<salt hex>$<key hex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash to compare against for unknown emails, so login timing doesn't reveal accounts. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword(randomBytes(16).toString('hex')));
}

let warned = false;
/** JWT secret from JWT_SECRET; refuses to run in production without one. */
export function resolveSecret(env = process.env): string {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  if (!warned && env.NODE_ENV !== 'test' && !env.VITEST) {
    console.warn('[auth] JWT_SECRET is not set – using an insecure development secret');
    warned = true;
  }
  return 'baktana-dev-secret-do-not-use-in-production';
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

function sign(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest();
}

/** Creates a JWT (HS256) for the user id. */
export function signToken(userId: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: userId, iat, exp: iat + TOKEN_TTL_SECONDS }));
  return `${header}.${payload}.${b64url(sign(`${header}.${payload}`, secret))}`;
}

/** Returns the user id of a valid, unexpired token, otherwise null. */
export function verifyToken(token: string, secret: string, now = Date.now()): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`, secret);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (h.alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof p.sub !== 'string' || typeof p.exp !== 'number') return null;
    if (p.exp * 1000 <= now) return null;
    return p.sub;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      userId?: string;
    }
  }
}

function bearer(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

/**
 * Reads the bearer token into res.locals.userId. With `required`, missing or
 * invalid tokens are rejected; otherwise an invalid token is treated as a guest.
 */
export function authenticate(secret: string, userExists: (id: string) => boolean, required: boolean): RequestHandler {
  return (req, res, next) => {
    const token = bearer(req.headers.authorization);
    const userId = token ? verifyToken(token, secret) : null;
    if (userId && userExists(userId)) {
      res.locals.userId = userId;
      return next();
    }
    if (required) return next(unauthorized());
    next();
  };
}

/** Fixed-window in-memory rate limit keyed by client IP. */
export function rateLimit({ max, windowMs }: { max: number; windowMs: number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      // Drop stale entries now and then so the map can't grow forever.
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'rate_limited', 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות'));
    }
    next();
  };
}
