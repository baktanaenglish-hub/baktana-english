import { describe, expect, it } from 'vitest';
import { allLessons } from '../../src/data/course';
import { HEART_REFILL_MS, MAX_HEARTS, initialProgress, type Progress } from '../../src/lib/progress';
import { MAX_TOTAL_XP, mergeProgress, sanitizeProgress } from './merge';

const NOW = new Date(2026, 9, 18, 12).getTime();
const [l1, l2, l3] = allLessons.map((l) => l.id);

const make = (patch: Partial<Progress>): Progress => ({ ...initialProgress(NOW), ...patch });

describe('mergeProgress', () => {
  it('keeps the max xp and the union of completed lessons with the max count', () => {
    const merged = mergeProgress(
      make({ xp: 40, completed: { [l1]: 3, [l2]: 1 } }),
      make({ xp: 25, completed: { [l1]: 1, [l3]: 2 } }),
      NOW,
    );
    expect(merged.xp).toBe(40);
    expect(merged.completed).toEqual({ [l1]: 3, [l2]: 1, [l3]: 2 });
  });

  it('takes streak and xpToday from the later lastActiveDate', () => {
    const stored = make({ lastActiveDate: '2026-10-10', streak: 9, xpToday: 30 });
    const incoming = make({ lastActiveDate: '2026-10-18', streak: 2, xpToday: 15 });
    expect(mergeProgress(stored, incoming, NOW)).toMatchObject({ lastActiveDate: '2026-10-18', streak: 2, xpToday: 15 });
    expect(mergeProgress(incoming, stored, NOW)).toMatchObject({ lastActiveDate: '2026-10-18', streak: 2, xpToday: 15 });
  });

  it('prefers any date over null', () => {
    const merged = mergeProgress(make({}), make({ lastActiveDate: '2026-10-18', streak: 1, xpToday: 10 }), NOW);
    expect(merged).toMatchObject({ lastActiveDate: '2026-10-18', streak: 1, xpToday: 10 });
  });

  it('on the same date keeps the higher streak and xpToday', () => {
    const merged = mergeProgress(
      make({ lastActiveDate: '2026-10-18', streak: 5, xpToday: 10 }),
      make({ lastActiveDate: '2026-10-18', streak: 3, xpToday: 25 }),
      NOW,
    );
    expect(merged).toMatchObject({ streak: 5, xpToday: 25 });
  });

  it('keeps the lower heart count after refills, so syncing cannot refill hearts', () => {
    const merged = mergeProgress(make({ hearts: 5 }), make({ hearts: 2, heartsUpdatedAt: NOW - 1000 }), NOW);
    expect(merged.hearts).toBe(2);
    expect(merged.heartsUpdatedAt).toBe(NOW - 1000);

    const refilled = mergeProgress(make({ hearts: 1, heartsUpdatedAt: NOW - 10 * HEART_REFILL_MS }), make({ hearts: 4 }), NOW);
    expect(refilled.hearts).toBe(4);
  });

  it('is a no-op when merging progress with itself', () => {
    const p = make({ xp: 70, completed: { [l1]: 2 }, lastActiveDate: '2026-10-18', streak: 3, xpToday: 20, hearts: MAX_HEARTS });
    expect(mergeProgress(p, p, NOW)).toEqual(p);
  });
});

describe('sanitizeProgress', () => {
  it('accepts valid progress and drops unknown lessons', () => {
    const p = sanitizeProgress(make({ xp: 12.7, completed: { [l1]: 1, bogus: 4, [l2]: 0 } }), NOW);
    expect(p).toMatchObject({ xp: 12, completed: { [l1]: 1 } });
  });

  it('clamps out-of-range values', () => {
    const p = sanitizeProgress(make({ xp: 1e12, hearts: 99, heartsUpdatedAt: NOW + 1e9 }), NOW)!;
    expect(p.xp).toBe(MAX_TOTAL_XP);
    expect(p.hearts).toBe(MAX_HEARTS);
    expect(p.heartsUpdatedAt).toBe(NOW);
  });

  it.each([
    null,
    [],
    'x',
    { ...make({}), xp: -1 },
    { ...make({}), xp: '5' },
    { ...make({}), completed: [] },
    { ...make({}), completed: { [l1]: 'a' } },
    { ...make({}), lastActiveDate: 'yesterday' },
    { ...make({}), hearts: undefined },
  ])('rejects malformed input %#', (input) => {
    expect(sanitizeProgress(input, NOW)).toBeNull();
  });
});
