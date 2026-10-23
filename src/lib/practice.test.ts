import { describe, expect, it } from 'vitest';
import { allLessons } from '../data/course';
import { canPractice, completePractice, generatePractice, PRACTICE_LENGTH } from './practice';
import { completeLesson, initialProgress } from './progress';
import { seededRng } from './random';

describe('practice', () => {
  const done = completeLesson(completeLesson(initialProgress(), allLessons[0].id, 10), allLessons[1].id, 10);

  it('needs at least one completed lesson', () => {
    expect(canPractice(initialProgress())).toBe(false);
    expect(generatePractice(initialProgress())).toEqual([]);
    expect(canPractice(done)).toBe(true);
  });

  it('mixes exercises with at most one matching round', () => {
    const exercises = generatePractice(done, seededRng(3));
    expect(exercises).toHaveLength(PRACTICE_LENGTH);
    expect(exercises.filter((e) => e.kind === 'match').length).toBeLessThanOrEqual(1);
  });

  it('awards xp and streak without completing a lesson', () => {
    const t = new Date(2026, 0, 10, 12).getTime();
    const p = completePractice(initialProgress(t), 10, t);
    expect(p.xp).toBe(10);
    expect(p.xpToday).toBe(10);
    expect(p.streak).toBe(1);
    expect(p.completed).toEqual({});
  });
});
