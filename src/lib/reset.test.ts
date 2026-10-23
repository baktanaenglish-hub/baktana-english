import { describe, expect, it } from 'vitest';
import { mergeProgress as serverMerge, sanitizeProgress } from '../../shared/progress-merge';
import { completeLesson, initialProgress, resetProgress } from './progress';
import { emptySrs, forgetBefore } from './srs';
import { mergeProgress as clientMerge } from './sync';

const old = completeLesson(initialProgress(1000), 'u1l1', 15, 2000);
const fresh = { ...resetProgress(old, 5000), dailyGoal: 20 };

describe('progress reset (US-A5)', () => {
  it('resetProgress starts over, keeps the goal and stamps the time', () => {
    const p = resetProgress({ ...old, dailyGoal: 50 }, 7000);
    expect(p).toMatchObject({ xp: 0, completed: {}, streak: 0, dailyGoal: 50, resetAt: 7000 });
  });

  it('the server merge lets the newer reset win in both directions', () => {
    expect(serverMerge(old, fresh, 6000).completed).toEqual({});
    expect(serverMerge(fresh, old, 6000).completed).toEqual({});
    expect(serverMerge(fresh, old, 6000).resetAt).toBe(5000);
  });

  it('a device adopts a newer reset from the server and keeps its own when newer', () => {
    expect(clientMerge(old, fresh, 6000)).toMatchObject({ xp: 0, completed: {}, resetAt: 5000 });
    expect(clientMerge(fresh, old, 6000).completed).toEqual({});
  });

  it('sanitize keeps resetAt but caps one in the future', () => {
    expect(sanitizeProgress(fresh, 6000)?.resetAt).toBe(5000);
    expect(sanitizeProgress({ ...fresh, resetAt: 99_999 }, 6000)?.resetAt).toBe(6000);
    expect(sanitizeProgress({ ...fresh, resetAt: 'soon' }, 6000)?.resetAt).toBeUndefined();
  });

  it('forgetBefore drops review items answered before the reset', () => {
    const item = (last: number) => ({ box: 2 as const, due: '2026-01-01', seen: 1, wrong: 0, last });
    const store = { ...emptySrs(), items: { a: item(100), b: item(9000) }, dirty: ['a', 'b'] };
    const after = forgetBefore(store, 5000);
    expect(Object.keys(after.items)).toEqual(['b']);
    expect(after.dirty).toEqual(['b']);
    expect(forgetBefore(store, undefined)).toBe(store);
  });
});
