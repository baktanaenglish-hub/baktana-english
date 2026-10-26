import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialGems } from './gems';
import { adoptPet } from './pet';
import { USER_STASH_KEY, stashUserData, takeUserStash } from './user-stash';

describe('user stash (sign-out)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    });
    return data;
  }

  it('gives a learner back their gems and pet once, and nobody else', () => {
    const data = stubStorage();
    const gems = { ...initialGems(), gems: 120 };
    const pet = adoptPet('owl', 'מוקה', 1)!;
    stashUserData('u1', { gems, pet });
    expect(data.has(`${USER_STASH_KEY}:u1`)).toBe(true);

    expect(takeUserStash('u2')).toBeNull();
    expect(takeUserStash('u1')).toEqual({ gems, pet });
    expect(takeUserStash('u1')).toBeNull();
  });

  it('keeps a learner without a pet petless, and ignores junk and blocked storage', () => {
    const data = stubStorage();
    stashUserData('u1', { gems: initialGems(), pet: null });
    expect(takeUserStash('u1')).toEqual({ gems: initialGems(), pet: null });

    data.set(`${USER_STASH_KEY}:u1`, '{oops');
    expect(takeUserStash('u1')).toBeNull();

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => stashUserData('u1', { gems: initialGems(), pet: null })).not.toThrow();
    expect(takeUserStash('u1')).toBeNull();
  });
});
