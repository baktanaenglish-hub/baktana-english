import { afterEach, describe, expect, it, vi } from 'vitest';
import { course } from '../data/course';
import { INTRO_SEEN_KEY, loadIntroSeen, markIntroSeen, parseIntroSeen, shouldAutoShowIntro } from './intro-seen';
import { completeLesson, initialProgress } from './progress';

const unit1 = course[0];
const unit2 = course[1];

describe('shouldAutoShowIntro (US-I1)', () => {
  it('AC1: shown before the first lesson of a unit with nothing completed and not seen', () => {
    expect(unit1.intro).toBeTruthy();
    expect(shouldAutoShowIntro(unit1, initialProgress(), [])).toBe(true);
  });

  it('AC2: not again once seen', () => {
    expect(shouldAutoShowIntro(unit1, initialProgress(), [unit1.id])).toBe(false);
  });

  it('not for a unit where a lesson is already completed (existing learners)', () => {
    const p = completeLesson(initialProgress(), unit2.lessons[0].id, 10);
    expect(shouldAutoShowIntro(unit2, p, [])).toBe(false);
    expect(shouldAutoShowIntro(unit1, p, [])).toBe(true);
  });

  it('never for a unit without an intro', () => {
    expect(shouldAutoShowIntro({ ...unit1, intro: undefined }, initialProgress(), [])).toBe(false);
  });
});

describe('intro-seen storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses a list of unit ids and ignores junk', () => {
    expect(parseIntroSeen(null)).toEqual([]);
    expect(parseIntroSeen('{oops')).toEqual([]);
    expect(parseIntroSeen('{"u1":true}')).toEqual([]);
    expect(parseIntroSeen('["u1",2,"u2","u1"]')).toEqual(['u1', 'u2']);
  });

  it('marks units as seen once, and survives blocked storage', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    expect(markIntroSeen('u1')).toEqual(['u1']);
    expect(markIntroSeen('u2')).toEqual(['u1', 'u2']);
    expect(markIntroSeen('u1')).toEqual(['u1', 'u2']);
    expect(JSON.parse(data.get(INTRO_SEEN_KEY)!)).toEqual(['u1', 'u2']);
    expect(loadIntroSeen()).toEqual(['u1', 'u2']);

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadIntroSeen()).toEqual([]);
    expect(markIntroSeen('u3', [])).toEqual(['u3']);
  });
});
