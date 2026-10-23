import { describe, expect, it } from 'vitest';
import { MAX_COMPLETED_KEYS, mergeProgress, sanitizeProgress } from '../../shared/progress-merge';
import { allLessons } from '../data/course';
import { currentLessonId, initialProgress, isCatchUp, isUnlocked, type Progress } from './progress';

const NOW = new Date(2026, 0, 10, 12).getTime();
const ids = allLessons.map((l) => l.id);
const withCompleted = (completed: string[]): Progress => ({
  ...initialProgress(NOW),
  completed: Object.fromEntries(completed.map((id) => [id, 1])),
});

describe('v2 unlock rule (docs/spec/v2.md §6.7.1, US-U1)', () => {
  it('AC1: a new learner only has the first lesson open', () => {
    const p = initialProgress(NOW);
    expect(ids.filter((id) => isUnlocked(p, id))).toEqual([ids[0]]);
    expect(ids.some((id) => isCatchUp(p, id))).toBe(false);
  });

  it('AC2: completing u1l1 opens u1l2 only', () => {
    const p = withCompleted(['u1l1']);
    expect(isUnlocked(p, 'u1l2')).toBe(true);
    expect(isUnlocked(p, 'u1l3')).toBe(false);
  });

  it('AC3 / §6.7.3: progress saved on the 16-lesson course loads with catch-up lessons', () => {
    // Every lesson of the old course up to u4l2.
    const old = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2', 'u3l1', 'u3l2', 'u4l1', 'u4l2'];
    const p = withCompleted(old);
    for (const id of old) expect(isUnlocked(p, id), id).toBe(true);
    expect(isUnlocked(p, 'u4l3')).toBe(true);
    expect(currentLessonId(p)).toBe('u4l3');
    const added = ['u1l4', 'u1l5', 'u2l3', 'u2l4', 'u2l5', 'u3l3', 'u3l4', 'u3l5'].filter((id) => ids.includes(id));
    for (const id of added) {
      expect(isUnlocked(p, id), id).toBe(true);
      expect(isCatchUp(p, id), id).toBe(true);
    }
    // Exactly the added lessons are catch-up; finished ones and the current one are not.
    expect(ids.filter((id) => isCatchUp(p, id))).toEqual(added);
    if (ids.includes('u4l4')) expect(isUnlocked(p, 'u4l4')).toBe(false);
  });

  it('AC4: unknown ids in completed do not affect unlocking', () => {
    const p = withCompleted(['u13l1', 'u99cp']);
    expect(ids.filter((id) => isUnlocked(p, id))).toEqual([ids[0]]);
    expect(currentLessonId(p)).toBe(ids[0]);
    expect(isUnlocked(p, 'u13l1')).toBe(false);
    expect(isCatchUp(p, 'u13l1')).toBe(false);
  });

  it('__practice__ is never a lesson', () => {
    const p = { ...initialProgress(NOW), completed: { __practice__: 3 } };
    expect(isUnlocked(p, '__practice__')).toBe(false);
    expect(ids.filter((id) => isUnlocked(p, id))).toEqual([ids[0]]);
    expect(currentLessonId(p)).toBe(ids[0]);
  });

  it('currentLessonId falls back to the first uncompleted lesson when the last one is done', () => {
    expect(currentLessonId(withCompleted([ids[0], ids.at(-1)!]))).toBe(ids[1]);
    expect(currentLessonId(withCompleted(ids))).toBeUndefined();
  });

  it('a completed lesson stays open even if the one before it is not completed', () => {
    const p = withCompleted([ids[3]]);
    expect(isUnlocked(p, ids[3])).toBe(true);
    expect(isUnlocked(p, ids[4])).toBe(true);
    expect(isUnlocked(p, ids[5])).toBe(false);
    expect(isCatchUp(p, ids[1])).toBe(true);
    expect(isCatchUp(p, ids[3])).toBe(false);
    expect(isCatchUp(p, ids[4])).toBe(false);
    expect(currentLessonId(p)).toBe(ids[4]);
  });
});

describe('tolerant sanitizeProgress (docs/spec/v2.md §6.7.2)', () => {
  const base: Progress = { ...initialProgress(NOW), xp: 10 };

  it('US-U1 AC4: keeps lesson ids of newer course versions', () => {
    const p = sanitizeProgress({ ...base, completed: { u1l1: 1, u13l1: 2 } }, NOW)!;
    expect(p.completed).toEqual({ u1l1: 1, u13l1: 2 });
  });

  it('US-U1 AC5: keeps checkpoint ids, drops malformed ids and __practice__', () => {
    const p = sanitizeProgress({ ...base, completed: { u12cp: 1, 'bad id': 1, __practice__: 1 } }, NOW)!;
    expect(p.completed).toEqual({ u12cp: 1 });
  });

  it(`keeps at most ${MAX_COMPLETED_KEYS} ids, known lessons first`, () => {
    const completed: Record<string, number> = {};
    for (let u = 13; u < 100; u++) for (let l = 1; l < 10; l++) completed[`u${u}l${l}`] = 1;
    completed[ids[0]] = 1;
    const p = sanitizeProgress({ ...base, completed }, NOW)!;
    expect(Object.keys(p.completed)).toHaveLength(MAX_COMPLETED_KEYS);
    expect(p.completed[ids[0]]).toBe(1);
    const merged = mergeProgress(p, { ...base, completed: { u99l99: 1 } }, NOW);
    expect(Object.keys(merged.completed)).toHaveLength(MAX_COMPLETED_KEYS);
    expect(merged.completed[ids[0]]).toBe(1);
  });

  it('a lesson completed by a newer client survives a merge with an older upload', () => {
    const stored = { ...base, completed: { u1l1: 1, u13l1: 1 } };
    const merged = mergeProgress(stored, sanitizeProgress({ ...base, completed: { u1l1: 2 } }, NOW)!, NOW);
    expect(merged.completed).toEqual({ u1l1: 2, u13l1: 1 });
  });
});
