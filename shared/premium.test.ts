import { describe, expect, it } from 'vitest';
import { isEntitled, isNewCall, isPremium, parsePremiumEmails, usageDay } from './premium';

describe('parsePremiumEmails', () => {
  it('splits, trims, lowercases and drops empty entries', () => {
    expect(parsePremiumEmails(' A@Example.com, b@example.com ,,  ,C@X.IO ')).toEqual(
      new Set(['a@example.com', 'b@example.com', 'c@x.io']),
    );
  });

  it('returns an empty set for missing or blank input', () => {
    expect(parsePremiumEmails()).toEqual(new Set());
    expect(parsePremiumEmails('')).toEqual(new Set());
    expect(parsePremiumEmails(' , ')).toEqual(new Set());
  });
});

describe('isPremium', () => {
  const set = parsePremiumEmails('dana@example.com');

  it('matches case-insensitively and ignores surrounding spaces', () => {
    expect(isPremium('dana@example.com', set)).toBe(true);
    expect(isPremium(' Dana@Example.COM ', set)).toBe(true);
  });

  it('rejects other, empty or missing emails', () => {
    expect(isPremium('other@example.com', set)).toBe(false);
    expect(isPremium('', set)).toBe(false);
    expect(isPremium(null, set)).toBe(false);
    expect(isPremium(undefined, set)).toBe(false);
    expect(isPremium('dana@example.com', new Set())).toBe(false);
  });
});

describe('isNewCall', () => {
  it('is true when the history has no learner message', () => {
    expect(isNewCall([])).toBe(true);
    expect(isNewCall([{ role: 'assistant', text: 'Hi!' }])).toBe(true);
    expect(isNewCall(undefined)).toBe(true);
    expect(isNewCall('nope')).toBe(true);
    expect(isNewCall([null, 3])).toBe(true);
  });

  it('is false once the learner has spoken', () => {
    expect(
      isNewCall([
        { role: 'assistant', text: 'Hi!' },
        { role: 'user', text: 'Hello' },
      ]),
    ).toBe(false);
  });
});

describe('usageDay', () => {
  it('uses the given time zone', () => {
    // 22:30 UTC on 1 March is already 2 March in Jerusalem (UTC+2 in winter).
    const t = Date.UTC(2026, 2, 1, 22, 30);
    expect(usageDay(t, 'Asia/Jerusalem')).toBe('2026-03-02');
    expect(usageDay(t, 'UTC')).toBe('2026-03-01');
  });

  it('falls back to the local date as YYYY-MM-DD', () => {
    expect(usageDay(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isEntitled', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  const day = 24 * 60 * 60 * 1000;

  it('counts a subscription paid until a later time', () => {
    expect(isEntitled('2026-11-21T12:00:00Z', now)).toBe(true);
  });

  it('keeps premium for a day past the end, then drops it', () => {
    expect(isEntitled('2026-10-21T00:00:00Z', now)).toBe(true);
    expect(isEntitled(new Date(now - day - 1).toISOString(), now)).toBe(false);
    expect(isEntitled('2026-10-21T00:00:00Z', now, 0)).toBe(false);
  });

  it('rejects missing or unreadable dates', () => {
    expect(isEntitled(null, now)).toBe(false);
    expect(isEntitled(undefined, now)).toBe(false);
    expect(isEntitled('', now)).toBe(false);
    expect(isEntitled('not a date', now)).toBe(false);
  });
});
