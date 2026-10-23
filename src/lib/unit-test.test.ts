import { describe, expect, it } from 'vitest';
import { sanitizeProgress } from '../../shared/progress-merge';
import { course } from '../data/course';
import { initialProgress } from './progress';
import { seededRng } from './random';
import { checkTyped } from './typing';
import {
  UNIT_TEST_QUESTIONS,
  UNIT_TEST_XP,
  applyUnitTest,
  unitTestId,
  unitTestOpen,
  unitTestPassed,
  unitTestQuestions,
  unitTestScore,
} from './unit-test';

describe('unit test questions', () => {
  it('asks ten answerable questions for every unit', () => {
    course.forEach((unit, i) => {
      const questions = unitTestQuestions(unit, i, seededRng(i + 1));
      expect(questions).toHaveLength(UNIT_TEST_QUESTIONS);
      expect(questions.filter((q) => q.kind === 'choice')).toHaveLength(4);
      for (const q of questions) {
        if (q.kind === 'choice') expect(q.options).toContain(q.answer);
        if (q.kind === 'type') expect(checkTyped(q.answers[0], q.answers).kind).toBe('correct');
      }
    });
  });

  it('types only from unit 2 and types listening from unit 4', () => {
    const kinds = (i: number) => unitTestQuestions(course[i], i, seededRng(3));
    expect(kinds(0).some((q) => q.kind === 'type')).toBe(false);
    expect(kinds(1).filter((q) => q.kind === 'type' && !q.listen)).toHaveLength(2);
    expect(kinds(3).some((q) => q.kind === 'type' && q.listen)).toBe(true);
  });
});

describe('unit test progress', () => {
  const unit = course[0];
  const allDone = { ...initialProgress(), completed: Object.fromEntries(unit.lessons.map((l) => [l.id, 1])) };

  it('opens once every lesson of the unit is done', () => {
    expect(unitTestOpen(initialProgress(), unit)).toBe(false);
    expect(unitTestOpen(allDone, unit)).toBe(true);
  });

  it('passes with eight of ten', () => {
    expect(unitTestScore([...Array(8).fill(true), false, false])).toEqual({ right: 8, passed: true });
    expect(unitTestScore([...Array(7).fill(true), false, false, false]).passed).toBe(false);
  });

  it('stores a pass under the checkpoint id with XP, and the id survives sanitizing', () => {
    const after = applyUnitTest(allDone, unit);
    expect(unitTestId(unit)).toBe('u1cp');
    expect(unitTestPassed(after, unit)).toBe(true);
    expect(after.xp).toBe(UNIT_TEST_XP);
    expect(sanitizeProgress(after)?.completed.u1cp).toBe(1);
  });
});
