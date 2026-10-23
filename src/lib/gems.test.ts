import { describe, expect, it } from 'vitest';
import {
  ALL_QUESTS_BONUS_GEMS,
  MAX_FREEZES,
  applyStreakFreeze,
  buy,
  canBuy,
  chestAvailable,
  chooseAvatar,
  initialGems,
  openChest,
  parseGems,
  rewardActivity,
  type GemState,
} from './gems';
import { initialProgress } from './progress';

const TODAY = '2026-10-20';
const rich = (gems: number): GemState => ({ ...initialGems(), gems });

describe('rewardActivity', () => {
  it('pays for a lesson, a flawless run and the daily goal', () => {
    const { state, rewards } = rewardActivity(
      initialGems(),
      { kind: 'lesson', flawless: true, goalReached: true },
      TODAY,
    );
    // 5 lesson + 5 flawless + 10 goal + 15 for the "perfect lesson" quest.
    expect(state.gems).toBe(35);
    expect(state.earned).toBe(35);
    expect(rewards.map((r) => r.gems)).toEqual([5, 5, 10, 15]);
    expect(state.quests).toEqual({ lessons: 1, perfect: 1, review: 0 });
  });

  it('pays each quest once and a bonus when all three are done', () => {
    let s = initialGems();
    s = rewardActivity(s, { kind: 'lesson', flawless: true, goalReached: false }, TODAY).state;
    s = rewardActivity(s, { kind: 'lesson', flawless: true, goalReached: false }, TODAY).state;
    const last = rewardActivity(s, { kind: 'review', flawless: false, goalReached: false }, TODAY);
    expect(last.rewards.at(-1)?.gems).toBe(ALL_QUESTS_BONUS_GEMS);
    expect(last.state.claimed).toHaveLength(3);
    const again = rewardActivity(last.state, { kind: 'review', flawless: false, goalReached: false }, TODAY);
    expect(again.rewards).toHaveLength(1);
  });

  it('starts the quests over on a new day', () => {
    const s = rewardActivity(initialGems(), { kind: 'review', flawless: false, goalReached: false }, TODAY).state;
    const next = rewardActivity(s, { kind: 'review', flawless: false, goalReached: false }, '2026-10-21');
    expect(next.rewards.some((r) => r.label.startsWith('משימה'))).toBe(true);
  });
});

describe('openChest', () => {
  it('opens once a day and grows with the opening streak', () => {
    const first = openChest(initialGems(), () => 0, '2026-10-19')!;
    expect(first.amount).toBe(5);
    expect(chestAvailable(first.state, '2026-10-19')).toBe(false);
    expect(openChest(first.state, () => 0, '2026-10-19')).toBeNull();
    const second = openChest(first.state, () => 0, TODAY)!;
    expect(second.state.chestStreak).toBe(2);
    expect(second.amount).toBe(7);
    // A skipped day starts the streak over.
    expect(openChest(second.state, () => 0, '2026-10-23')!.state.chestStreak).toBe(1);
  });
});

describe('shop', () => {
  it('buys bonus hearts and freezes within the limits', () => {
    expect(buy(rich(10), 'hearts')).toBeNull();
    const s = buy(rich(200), 'hearts')!;
    expect(s).toMatchObject({ gems: 170, bonusHearts: 3 });
    let f = rich(500);
    for (let i = 0; i < MAX_FREEZES; i++) f = buy(f, 'freeze')!;
    expect(f.freezes).toBe(MAX_FREEZES);
    expect(canBuy(f, 'freeze')).toBe(false);
  });

  it('buys an avatar once, then selects it for free', () => {
    const s = chooseAvatar(rich(100), 'fox')!;
    expect(s).toMatchObject({ gems: 60, avatar: 'fox', avatars: ['fox'] });
    expect(chooseAvatar({ ...s, avatar: null }, 'fox')!.gems).toBe(60);
    expect(chooseAvatar(rich(10), 'fox')).toBeNull();
  });
});

describe('applyStreakFreeze', () => {
  const now = new Date(2026, 9, 20, 12).getTime();
  const p = { ...initialProgress(now), streak: 4, xpToday: 12 };

  it('covers missed days when there are enough freezes', () => {
    const one = applyStreakFreeze({ ...p, lastActiveDate: '2026-10-18' }, 1, now)!;
    expect(one).toMatchObject({ used: 1, progress: { lastActiveDate: '2026-10-19', streak: 4, xpToday: 0 } });
    expect(applyStreakFreeze({ ...p, lastActiveDate: '2026-10-17' }, 1, now)).toBeNull();
    expect(applyStreakFreeze({ ...p, lastActiveDate: '2026-10-17' }, 2, now)?.used).toBe(2);
  });

  it('does nothing when no day was missed or there is no streak', () => {
    expect(applyStreakFreeze({ ...p, lastActiveDate: '2026-10-19' }, 2, now)).toBeNull();
    expect(applyStreakFreeze({ ...p, lastActiveDate: '2026-10-20' }, 2, now)).toBeNull();
    expect(applyStreakFreeze({ ...p, streak: 0, lastActiveDate: '2026-10-18' }, 2, now)).toBeNull();
  });
});

describe('parseGems', () => {
  it('ignores malformed and unknown values', () => {
    expect(parseGems('nope')).toEqual(initialGems());
    const s = parseGems(JSON.stringify({ gems: -3, freezes: 9, avatars: ['fox', 'x'], avatar: 'x', claimed: ['?'] }));
    expect(s).toMatchObject({ gems: 0, freezes: MAX_FREEZES, avatars: ['fox'], avatar: null, claimed: [] });
  });
});
