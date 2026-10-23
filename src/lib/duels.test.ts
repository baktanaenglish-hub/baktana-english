import { describe, expect, it } from 'vitest';
import type { DuelSummary } from '../../shared/duels';
import { applyDuels, duelNotices, initialDuelsLocal, parseDuelsLocal, unclaimedDuels } from './duels';

const base: DuelSummary = {
  id: 'd1',
  inviteCode: 'ABC234',
  isChallenger: true,
  createdAt: 0,
  startsAt: null,
  endsAt: 1,
  state: 'waiting',
  result: null,
  me: { displayName: 'דנה', xp: 0 },
  opponent: null,
};
const accepted: DuelSummary = { ...base, state: 'active', startsAt: 1, opponent: { displayName: 'יוסי', xp: 0 } };

describe('duel notices', () => {
  it('tells the challenger when a friend accepted their invite', () => {
    const [notice] = duelNotices({ d1: 'waiting' }, [accepted], 5);
    expect(notice).toMatchObject({ id: 'd1|accepted', duelId: 'd1', at: 5 });
    expect(notice.text).toContain('יוסי');
    expect(notice.text).toContain('התחרות התחילה');
  });

  it('says nothing to the friend who accepted, for a duel seen for the first time, or when nothing changed', () => {
    expect(duelNotices({ d1: 'waiting' }, [{ ...accepted, isChallenger: false }])).toEqual([]);
    expect(duelNotices({}, [accepted])).toEqual([]);
    expect(duelNotices({ d1: 'active' }, [accepted])).toEqual([]);
    expect(duelNotices({ d1: 'waiting' }, [base])).toEqual([]);
  });

  it('applies a fresh list once: the notice is new only the first time', () => {
    const seenWaiting = applyDuels(initialDuelsLocal(), [base], 1);
    expect(seenWaiting.fresh).toEqual([]);
    expect(seenWaiting.state.seen).toEqual({ d1: 'waiting' });
    const first = applyDuels(seenWaiting.state, [accepted], 2);
    expect(first.fresh).toHaveLength(1);
    expect(first.state.notices).toHaveLength(1);
    // The same change seen again (e.g. from older storage) doesn't notify twice.
    const again = applyDuels({ ...first.state, seen: { d1: 'waiting' } }, [accepted], 3);
    expect(again.fresh).toEqual([]);
    expect(again.state.notices).toHaveLength(1);
  });

  it('forgets notices and prizes of duels no longer listed', () => {
    const state = { ...initialDuelsLocal(), claimed: ['d1', 'gone'] };
    const withNotice = applyDuels({ ...state, seen: { d1: 'waiting' } }, [accepted], 2).state;
    expect(withNotice.claimed).toEqual(['d1']);
    expect(applyDuels(withNotice, [], 3).state.notices).toEqual([]);
  });
});

describe('parseDuelsLocal', () => {
  it('reads the first version, which stored only the collected prizes', () => {
    expect(parseDuelsLocal('["d1", 5]')).toEqual({ ...initialDuelsLocal(), claimed: ['d1'] });
    expect(parseDuelsLocal('not json')).toEqual(initialDuelsLocal());
    expect(parseDuelsLocal(null)).toEqual(initialDuelsLocal());
  });
});

it('lists finished duels whose prize is waiting', () => {
  const finished = { ...accepted, state: 'finished' as const, result: 'won' as const };
  expect(unclaimedDuels([finished, accepted], [])).toEqual([finished]);
  expect(unclaimedDuels([finished], ['d1'])).toEqual([]);
});
