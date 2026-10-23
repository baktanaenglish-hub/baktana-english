import { DAILY_GOAL_XP, type Progress } from './progress';

export interface GoalOption {
  xp: number;
  label: string;
  hint: string;
}

/** Daily goals offered in onboarding and in the profile. */
export const GOAL_OPTIONS: GoalOption[] = [
  { xp: 10, label: 'קליל', hint: 'כ־5 דקות ביום' },
  { xp: 20, label: 'רגיל', hint: 'כ־10 דקות ביום' },
  { xp: 30, label: 'רציני', hint: 'כ־15 דקות ביום' },
  { xp: 50, label: 'אינטנסיבי', hint: 'כ־25 דקות ביום' },
];

export function dailyGoalOf(p: Progress): number {
  return p.dailyGoal && p.dailyGoal > 0 ? p.dailyGoal : DAILY_GOAL_XP;
}

export function setDailyGoal(p: Progress, xp: number): Progress {
  return { ...p, dailyGoal: xp };
}

/** First-time learners (nothing done, no goal picked yet) see the onboarding flow. */
export function needsOnboarding(p: Progress): boolean {
  return p.dailyGoal === undefined && p.xp === 0 && Object.keys(p.completed).length === 0;
}

/** True when going from `before` to `after` crossed today's daily goal. */
export function reachesGoal(before: Progress, after: Progress): boolean {
  const goal = dailyGoalOf(after);
  const prev = before.lastActiveDate === after.lastActiveDate ? before.xpToday : 0;
  return prev < goal && after.xpToday >= goal;
}
