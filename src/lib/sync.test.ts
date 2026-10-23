import { describe, expect, it } from 'vitest';
import { initialProgress, type Progress } from './progress';
import { mergeProgress } from './sync';

const now = new Date(2026, 0, 10, 12).getTime();

function make(patch: Partial<Progress>): Progress {
  return { ...initialProgress(now), ...patch };
}

describe('mergeProgress', () => {
  it('takes max xp and the union of completed lessons', () => {
    const local = make({ xp: 40, completed: { u1l1: 2, u1l2: 1 } });
    const server = make({ xp: 25, completed: { u1l1: 1, u1l3: 3 } });
    const merged = mergeProgress(local, server, now);
    expect(merged.xp).toBe(40);
    expect(merged.completed).toEqual({ u1l1: 2, u1l2: 1, u1l3: 3 });
  });

  it('keeps the streak of the later active date', () => {
    const local = make({ lastActiveDate: '2026-01-08', streak: 5, xpToday: 30 });
    const server = make({ lastActiveDate: '2026-01-10', streak: 2, xpToday: 10 });
    const merged = mergeProgress(local, server, now);
    expect(merged.lastActiveDate).toBe('2026-01-10');
    expect(merged.streak).toBe(2);
    expect(merged.xpToday).toBe(10);
  });

  it('keeps local hearts and daily goal', () => {
    const local = make({ hearts: 2, heartsUpdatedAt: now, dailyGoal: 50 });
    const server = make({ hearts: 5, dailyGoal: 10 });
    const merged = mergeProgress(local, server, now);
    expect(merged.hearts).toBe(2);
    expect(merged.dailyGoal).toBe(50);
    expect(mergeProgress(make({}), server, now).dailyGoal).toBe(10);
  });
});
