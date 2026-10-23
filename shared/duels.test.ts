import { describe, expect, it } from 'vitest';
import {
  DUEL_INVITE_MS,
  DUEL_MS,
  DUEL_SHOWN_AFTER_END_MS,
  duelLink,
  duelOpen,
  duelResult,
  summarizeDuel,
  summarizeDuels,
  type DuelRecord,
} from './duels';

const T = Date.UTC(2026, 9, 1);
const waiting: DuelRecord = {
  id: 'w',
  inviteCode: 'ABC234',
  isChallenger: true,
  createdAt: T,
  startsAt: null,
  me: { displayName: 'דנה', xp: 0 },
  opponent: null,
};
const running: DuelRecord = {
  ...waiting,
  id: 'r',
  startsAt: T + 1000,
  me: { displayName: 'דנה', xp: 40 },
  opponent: { displayName: 'יוסי', xp: 25 },
};

describe('duels', () => {
  it('scores the result from my side', () => {
    expect(duelResult(40, 25)).toBe('won');
    expect(duelResult(10, 25)).toBe('lost');
    expect(duelResult(5, 5)).toBe('tie');
  });

  it('waits for a friend until the invite expires', () => {
    expect(summarizeDuel(waiting, T)).toMatchObject({ state: 'waiting', endsAt: T + DUEL_INVITE_MS, result: null });
    expect(duelOpen(waiting, T + DUEL_INVITE_MS - 1)).toBe(true);
    expect(summarizeDuels([waiting], T + DUEL_INVITE_MS)).toEqual([]);
  });

  it('runs for a week, then has a result and stays listed for the prize', () => {
    expect(summarizeDuel(running, T + 2000)).toMatchObject({
      state: 'active',
      result: null,
      endsAt: T + 1000 + DUEL_MS,
    });
    const end = T + 1000 + DUEL_MS;
    expect(duelOpen(running, end)).toBe(false);
    expect(summarizeDuel(running, end)).toMatchObject({ state: 'finished', result: 'won' });
    expect(summarizeDuels([running], end + DUEL_SHOWN_AFTER_END_MS - 1)).toHaveLength(1);
    expect(summarizeDuels([running], end + DUEL_SHOWN_AFTER_END_MS)).toEqual([]);
  });

  it('lists the newest first', () => {
    const later = { ...waiting, id: 'later', createdAt: T + 5000 };
    expect(summarizeDuels([running, later], T + 6000).map((d) => d.id)).toEqual(['later', 'r']);
  });

  it('builds the invite link', () => {
    expect(duelLink('https://example.com/app/?x=1#y', 'ABC234')).toBe('https://example.com/app/?duel=ABC234');
  });
});
