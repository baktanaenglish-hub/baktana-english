import { describe, expect, it } from 'vitest';
import { course } from '../data/course';
import { checkTyped } from './typing';
import {
  applyPlacement,
  parsePlacement,
  placementDone,
  placementQuestions,
  QUESTIONS_PER_UNIT,
  unitQuestions,
  unitsPassed,
} from './placement';
import { initialProgress, isUnlocked } from './progress';
import { seededRng } from './random';

describe('placement questions', () => {
  it('asks three answerable questions per unit, in course order', () => {
    const questions = placementQuestions(seededRng(4));
    expect(questions).toHaveLength(course.length * QUESTIONS_PER_UNIT);
    for (const q of questions) {
      if (q.kind === 'choice') expect(q.options).toContain(q.answer);
      if (q.kind === 'type') expect(checkTyped(q.answers[0], q.answers).kind).toBe('correct');
    }
  });

  it('builds sentences from tiles in unit 1 and types them later', () => {
    expect(unitQuestions(course[0], 0, seededRng(1)).map((q) => q.kind)).toEqual(['choice', 'build', 'choice']);
    expect(unitQuestions(course[3], 3, seededRng(1)).map((q) => q.kind)).toEqual(['choice', 'type', 'choice']);
  });
});

describe('scoring', () => {
  const t = true;
  const f = false;

  it('passes a unit with two of three and stops at the first unit below that', () => {
    expect(unitsPassed([t, f, t, t, t, t, f, f, t])).toBe(2);
    expect(placementDone([t, f, t])).toBe(false);
    expect(placementDone([t, f, t, f, f])).toBe(false);
    expect(placementDone([t, f, t, f, f, t])).toBe(true);
    expect(unitsPassed([f, f, t])).toBe(0);
  });

  it('ignores an unfinished unit', () => {
    expect(unitsPassed([t, t, t, t, t])).toBe(1);
  });
});

describe('applyPlacement', () => {
  it('completes the passed units and unlocks the next one, without XP', () => {
    const after = applyPlacement(initialProgress(), 2);
    for (const lesson of [...course[0].lessons, ...course[1].lessons]) expect(after.completed[lesson.id]).toBe(1);
    expect(after.completed[course[2].lessons[0].id]).toBeUndefined();
    expect(isUnlocked(after, course[2].lessons[0].id)).toBe(true);
    expect(after.xp).toBe(0);
  });

  it('keeps lessons already done more than once', () => {
    const p = { ...initialProgress(), completed: { [course[0].lessons[0].id]: 3 } };
    expect(applyPlacement(p, 1).completed[course[0].lessons[0].id]).toBe(3);
  });
});

describe('resuming a placement test', () => {
  const exercises = placementQuestions(seededRng(2));
  const raw = (answers: boolean[]) => JSON.stringify({ exercises, answers });

  it('restores a test left in the middle', () => {
    expect(parsePlacement(raw([true, true, false, true]))).toEqual({ exercises, answers: [true, true, false, true] });
  });

  it('ignores missing, malformed, finished or untouched tests', () => {
    expect(parsePlacement(null)).toBeNull();
    expect(parsePlacement('not json')).toBeNull();
    expect(parsePlacement(raw([]))).toBeNull();
    expect(parsePlacement(raw([true, false, false]))).toBeNull();
    expect(parsePlacement(JSON.stringify({ exercises: exercises.slice(3), answers: [true] }))).toBeNull();
    expect(parsePlacement(JSON.stringify({ exercises, answers: ['yes'] }))).toBeNull();
  });
});
