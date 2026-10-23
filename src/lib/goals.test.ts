import { describe, expect, it } from 'vitest';
import { dailyGoalOf, needsOnboarding, reachesGoal, setDailyGoal } from './goals';
import { DAILY_GOAL_XP, completeLesson, initialProgress } from './progress';

const t = new Date(2026, 0, 10, 12).getTime();

describe('daily goal', () => {
  it('falls back to the default for older saves', () => {
    expect(dailyGoalOf(initialProgress())).toBe(DAILY_GOAL_XP);
    expect(dailyGoalOf(setDailyGoal(initialProgress(), 50))).toBe(50);
  });

  it('onboards only brand-new learners', () => {
    const fresh = initialProgress();
    expect(needsOnboarding(fresh)).toBe(true);
    expect(needsOnboarding(setDailyGoal(fresh, 10))).toBe(false);
    expect(needsOnboarding(completeLesson(fresh, 'u1l1', 10))).toBe(false);
  });

  it('detects crossing the goal', () => {
    const p = setDailyGoal(initialProgress(t), 20);
    const one = completeLesson(p, 'u1l1', 10, t);
    const two = completeLesson(one, 'u1l2', 15, t);
    expect(reachesGoal(p, one)).toBe(false);
    expect(reachesGoal(one, two)).toBe(true);
    expect(reachesGoal(two, completeLesson(two, 'u1l3', 10, t))).toBe(false);
  });
});
