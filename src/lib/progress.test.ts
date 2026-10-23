import { describe, expect, it } from 'vitest';
import { allLessons } from '../data/course';
import {
  HEART_REFILL_MS,
  MAX_HEARTS,
  completeLesson,
  currentLessonId,
  initialProgress,
  isUnlocked,
  loseHeart,
  refresh,
  visibleStreak,
} from './progress';

const day = (d: number, hour = 12) => new Date(2026, 0, d, hour).getTime();

describe('hearts', () => {
  it('loses a heart and refills over time', () => {
    let p = initialProgress(day(1));
    p = loseHeart(p, day(1));
    p = loseHeart(p, day(1));
    expect(p.hearts).toBe(MAX_HEARTS - 2);
    expect(refresh(p, day(1) + HEART_REFILL_MS).hearts).toBe(MAX_HEARTS - 1);
    expect(refresh(p, day(1) + 10 * HEART_REFILL_MS).hearts).toBe(MAX_HEARTS);
  });

  it('never goes below zero', () => {
    let p = initialProgress(day(1));
    for (let i = 0; i < MAX_HEARTS + 3; i++) p = loseHeart(p, day(1));
    expect(p.hearts).toBe(0);
  });
});

describe('streak and xp', () => {
  it('grows on consecutive days and resets after a gap', () => {
    let p = initialProgress(day(1));
    p = completeLesson(p, 'u1l1', 10, day(1, 9));
    p = completeLesson(p, 'u1l2', 10, day(1, 20));
    expect(p.streak).toBe(1);
    expect(p.xpToday).toBe(20);
    p = completeLesson(p, 'u1l3', 15, day(2));
    expect(p.streak).toBe(2);
    expect(p.xpToday).toBe(15);
    expect(p.xp).toBe(35);
    expect(visibleStreak(p, day(3))).toBe(2);
    expect(visibleStreak(p, day(4))).toBe(0);
    p = completeLesson(p, 'u1l1', 10, day(5));
    expect(p.streak).toBe(1);
  });

  it('clears daily xp on a new day', () => {
    const p = completeLesson(initialProgress(day(1)), 'u1l1', 10, day(1));
    expect(refresh(p, day(2)).xpToday).toBe(0);
  });
});

describe('unlocking', () => {
  it('opens lessons in order', () => {
    let p = initialProgress();
    expect(isUnlocked(p, allLessons[0].id)).toBe(true);
    expect(isUnlocked(p, allLessons[1].id)).toBe(false);
    expect(currentLessonId(p)).toBe(allLessons[0].id);
    p = completeLesson(p, allLessons[0].id, 10);
    expect(isUnlocked(p, allLessons[1].id)).toBe(true);
    expect(currentLessonId(p)).toBe(allLessons[1].id);
  });
});
