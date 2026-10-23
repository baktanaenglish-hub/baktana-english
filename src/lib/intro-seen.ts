/**
 * Which unit intros the learner has already seen. Spec: docs/spec/v2.md §7.3.
 * Owned by the UI agent.
 */
import type { Unit } from '../types';
import type { Progress } from './progress';

export const INTRO_SEEN_KEY = 'baktana-english:intro-seen:v1';

/** Parses the stored list of unit ids, ignoring anything malformed. */
export function parseIntroSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? [...new Set(data.filter((id): id is string => typeof id === 'string'))] : [];
  } catch {
    return [];
  }
}

export function loadIntroSeen(): string[] {
  try {
    return parseIntroSeen(localStorage.getItem(INTRO_SEEN_KEY));
  } catch {
    return [];
  }
}

/** Adds the unit to the stored list and returns the new list. Storage errors are ignored. */
export function markIntroSeen(unitId: string, seen: readonly string[] = loadIntroSeen()): string[] {
  const next = seen.includes(unitId) ? [...seen] : [...seen, unitId];
  try {
    localStorage.setItem(INTRO_SEEN_KEY, JSON.stringify(next));
  } catch {
    // Ignore – the intro may just be shown again.
  }
  return next;
}

/** Shown before a lesson when the unit has an intro, nothing in it is completed and it was not seen. */
export function shouldAutoShowIntro(unit: Unit, progress: Progress, seen: readonly string[]): boolean {
  if (!unit.intro || seen.includes(unit.id)) return false;
  return !unit.lessons.some((l) => (progress.completed[l.id] ?? 0) > 0);
}
