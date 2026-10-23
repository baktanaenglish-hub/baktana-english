import { afterEach, describe, expect, it, vi } from 'vitest';
import { allLessons } from '../data/course';
import { completeLesson, initialProgress } from './progress';
import {
  EMPTY_SIGNUP_PROMPT,
  SIGNUP_PROMPT_KEY,
  dismiss,
  lessonsCompleted,
  loadSignupPrompt,
  markShown,
  parseSignupPrompt,
  retire,
  saveSignupPrompt,
  signupRound,
  type SignupPromptState,
} from './signup-prompt';

const guest = (n: number, state: SignupPromptState = EMPTY_SIGNUP_PROMPT) =>
  signupRound({ accountsEnabled: true, signedIn: false, lessonsCompleted: n, state });

describe('signupRound (US-S1)', () => {
  it('AC1: a guest who finished the first lesson gets round 1', () => {
    expect(guest(1)).toBe(1);
  });

  it('AC3: after "maybe later" – nothing in lessons 2–4, round 2 from lesson 5, never after two', () => {
    const once = dismiss(EMPTY_SIGNUP_PROMPT);
    expect(guest(1, once)).toBeNull();
    for (const n of [2, 3, 4]) expect(guest(n, once)).toBeNull();
    expect(guest(5, once)).toBe(2);
    expect(guest(9, once)).toBe(2);
    const twice = dismiss(once);
    for (const n of [1, 5, 20]) expect(guest(n, twice)).toBeNull();
  });

  it('without dismissing, only the first lesson shows the first round', () => {
    for (const n of [0, 2, 5]) expect(guest(n)).toBeNull();
  });

  it('AC4: signed in or no accounts → never', () => {
    const base = { lessonsCompleted: 1, state: EMPTY_SIGNUP_PROMPT };
    expect(signupRound({ ...base, accountsEnabled: true, signedIn: true })).toBeNull();
    expect(signupRound({ ...base, accountsEnabled: false, signedIn: false })).toBeNull();
  });

  it('after signing in or up it never comes back, even signed out', () => {
    expect(guest(1, retire(EMPTY_SIGNUP_PROMPT))).toBeNull();
    expect(guest(5, retire(dismiss(EMPTY_SIGNUP_PROMPT)))).toBeNull();
  });

  it('counts distinct completed course lessons only', () => {
    let p = completeLesson(initialProgress(), allLessons[0].id, 10);
    p = completeLesson(p, allLessons[0].id, 10);
    p = completeLesson(p, '__practice__', 10);
    p = { ...p, completed: { ...p.completed, u13l1: 1 } };
    expect(lessonsCompleted(p)).toBe(1);
    expect(lessonsCompleted(completeLesson(p, allLessons[1].id, 10))).toBe(2);
  });
});

describe('signup prompt storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses the stored state and ignores junk', () => {
    expect(parseSignupPrompt(null)).toEqual(EMPTY_SIGNUP_PROMPT);
    expect(parseSignupPrompt('{oops')).toEqual(EMPTY_SIGNUP_PROMPT);
    expect(parseSignupPrompt('null')).toEqual(EMPTY_SIGNUP_PROMPT);
    expect(parseSignupPrompt('{"dismissCount":-1,"lastShownAt":"x"}')).toEqual(EMPTY_SIGNUP_PROMPT);
    expect(parseSignupPrompt('{"dismissCount":1,"lastShownAt":5}')).toEqual({ dismissCount: 1, lastShownAt: 5 });
  });

  it('round-trips through localStorage and survives blocked storage', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    saveSignupPrompt(markShown(dismiss(EMPTY_SIGNUP_PROMPT), 42));
    expect(JSON.parse(data.get(SIGNUP_PROMPT_KEY)!)).toEqual({ dismissCount: 1, lastShownAt: 42 });
    expect(loadSignupPrompt()).toEqual({ dismissCount: 1, lastShownAt: 42 });

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadSignupPrompt()).toEqual(EMPTY_SIGNUP_PROMPT);
    expect(() => saveSignupPrompt(EMPTY_SIGNUP_PROMPT)).not.toThrow();
  });
});
