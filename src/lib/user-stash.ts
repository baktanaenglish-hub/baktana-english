/**
 * Gems and the pet live only on the device (they are not part of the server's progress), so when a
 * learner signs out they are put aside under their user id instead of staying with the guest who
 * uses the device next. Signing in again as the same learner brings them back.
 */
import { parseGems, type GemState } from './gems';
import { parsePet, type PetState } from './pet';

export const USER_STASH_KEY = 'baktana-english:user-stash:v1';

export interface UserStash {
  gems: GemState;
  pet: PetState | null;
}

function storageKey(userId: string): string {
  return `${USER_STASH_KEY}:${userId}`;
}

/** Puts the learner's device-only state aside. Storage errors are ignored. */
export function stashUserData(userId: string, stash: UserStash): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(stash));
  } catch {
    // No storage: the state is just not kept.
  }
}

/** Returns (and removes) what was put aside for this learner, or null if nothing was. */
export function takeUserStash(userId: string): UserStash | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw === null) return null;
    localStorage.removeItem(storageKey(userId));
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      gems: parseGems(JSON.stringify(data.gems ?? null)),
      pet: data.pet ? parsePet(JSON.stringify(data.pet)) : null,
    };
  } catch {
    return null;
  }
}
