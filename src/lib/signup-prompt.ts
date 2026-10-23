/**
 * When to offer a guest to sign up after a lesson. Spec: docs/spec/v2.md §7.4.
 * Owned by the UI agent.
 */
import { allLessons } from '../data/course';
import type { Progress } from './progress';

export const SIGNUP_PROMPT_KEY = 'baktana-english:signup-prompt:v1';
/** After this many "maybe later" answers the prompt never comes back. */
export const MAX_DISMISSALS = 2;
/** The second offer comes once this many different lessons are completed. */
export const SECOND_ROUND_LESSONS = 5;

export interface SignupPromptState {
  dismissCount: number;
  /** ms timestamp the prompt was last shown, or null. */
  lastShownAt: number | null;
}

export type SignupRound = 1 | 2;

export const EMPTY_SIGNUP_PROMPT: SignupPromptState = { dismissCount: 0, lastShownAt: null };

/** Parses the stored state, ignoring anything malformed. */
export function parseSignupPrompt(raw: string | null): SignupPromptState {
  if (!raw) return EMPTY_SIGNUP_PROMPT;
  try {
    const data = JSON.parse(raw) as Partial<SignupPromptState> | null;
    const count = data?.dismissCount;
    const shown = data?.lastShownAt;
    return {
      dismissCount: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : 0,
      lastShownAt: typeof shown === 'number' && Number.isFinite(shown) ? shown : null,
    };
  } catch {
    return EMPTY_SIGNUP_PROMPT;
  }
}

export function loadSignupPrompt(): SignupPromptState {
  try {
    return parseSignupPrompt(localStorage.getItem(SIGNUP_PROMPT_KEY));
  } catch {
    return EMPTY_SIGNUP_PROMPT;
  }
}

export function saveSignupPrompt(state: SignupPromptState): void {
  try {
    localStorage.setItem(SIGNUP_PROMPT_KEY, JSON.stringify(state));
  } catch {
    // Ignore – the prompt may just come back.
  }
}

/** Number of different course lessons completed at least once. */
export function lessonsCompleted(p: Progress): number {
  return allLessons.filter((l) => (p.completed[l.id] ?? 0) >= 1).length;
}

export interface SignupPromptInput {
  accountsEnabled: boolean;
  signedIn: boolean;
  /** Distinct lessons completed, counted after the lesson that just ended. */
  lessonsCompleted: number;
  state: SignupPromptState;
}

/** Which offer to show on a lesson's completion screen, or null for none. Never after a review. */
export function signupRound({
  accountsEnabled,
  signedIn,
  lessonsCompleted,
  state,
}: SignupPromptInput): SignupRound | null {
  if (!accountsEnabled || signedIn) return null;
  if (lessonsCompleted === 1 && state.dismissCount === 0) return 1;
  if (lessonsCompleted >= SECOND_ROUND_LESSONS && state.dismissCount === 1) return 2;
  return null;
}

export function markShown(state: SignupPromptState, now = Date.now()): SignupPromptState {
  return { ...state, lastShownAt: now };
}

export function dismiss(state: SignupPromptState): SignupPromptState {
  return { ...state, dismissCount: state.dismissCount + 1 };
}

/** After signing in or up the prompt is never shown again, even after signing out. */
export function retire(state: SignupPromptState): SignupPromptState {
  return { ...state, dismissCount: Math.max(state.dismissCount, MAX_DISMISSALS) };
}
