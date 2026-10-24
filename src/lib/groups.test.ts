import { describe, expect, it } from 'vitest';
import { summarizeGroup, type GroupSummary } from '../../shared/groups';
import {
  applyGroups,
  claimable,
  claimKey,
  endsInText,
  initialGroupsLocal,
  parseGroupsLocal,
  unreadCount,
} from './groups';

const WEEK = Date.parse('2026-10-17T21:00:00Z');
const NEXT_WEEK = WEEK + 7 * 24 * 3600 * 1000;

function group(over: { id?: string; week?: number; rank?: number | null; members?: number; xp?: number } = {}) {
  const week = over.week ?? WEEK;
  return summarizeGroup(
    {
      id: over.id ?? 'g1',
      name: 'המשפחה',
      inviteCode: 'ABC234',
      memberCount: over.members ?? 2,
      isOwner: true,
      joinedAt: 0,
    },
    { xp: over.xp ?? 0, lessons: 0, activeDays: 0 },
    over.rank ?? null,
    { start: week, end: week + 7 * 24 * 3600 * 1000 },
  );
}

function after(...lists: GroupSummary[][]) {
  let state = initialGroupsLocal();
  let fresh = [] as ReturnType<typeof applyGroups>['fresh'];
  lists.forEach((groups, i) => ({ state, fresh } = applyGroups(state, groups, 1000 + i)));
  return { state, fresh };
}

describe('group notices', () => {
  it('says nothing about a group seen for the first time', () => {
    expect(after([group()]).fresh).toEqual([]);
  });

  it('announces a new week of challenges', () => {
    const { fresh } = after([group()], [group({ week: NEXT_WEEK })]);
    expect(fresh.map((n) => n.kind)).toEqual(['challenges']);
    expect(fresh[0].text).toContain('3 אתגרים חדשים');
  });

  it('celebrates a completed challenge once', () => {
    const { state, fresh } = after([group()], [group({ xp: 10_000 })], [group({ xp: 10_001 })]);
    expect(fresh).toEqual([]);
    expect(state.notices.filter((n) => n.kind === 'achievement')).toHaveLength(1);
    expect(state.notices[0].text).toContain('השלימה את האתגר');
  });

  it('reports big rank changes and entering the top three, not small moves', () => {
    expect(after([group({ rank: 8 })], [group({ rank: 7 })]).fresh).toEqual([]);
    expect(after([group({ rank: 8 })], [group({ rank: 4 })]).fresh[0].text).toContain('עלתה למקום 4');
    expect(after([group({ rank: 4 })], [group({ rank: 3 })]).fresh[0].text).toContain('עלתה למקום 3');
    expect(after([group({ rank: 2 })], [group({ rank: 6 })]).fresh[0].text).toContain('ירדה למקום 6');
    expect(after([group()], [group({ rank: 1 })]).fresh[0].text).toContain('נכנסה למקום 1');
  });

  it('welcomes new members', () => {
    expect(after([group()], [group({ members: 4 })]).fresh[0].text).toContain('2 חברים חדשים');
  });

  it('counts unread notices and drops those of groups the learner left', () => {
    const { state } = after(
      [group(), group({ id: 'g2' })],
      [group({ week: NEXT_WEEK }), group({ id: 'g2', week: NEXT_WEEK })],
    );
    expect(unreadCount(state)).toBe(2);
    expect(unreadCount({ ...state, readAt: 5000 })).toBe(0);
    expect(applyGroups(state, [group({ week: NEXT_WEEK })]).state.notices).toHaveLength(1);
  });
});

describe('challenge rewards', () => {
  it('lists completed challenges until their gems are collected, for this week only', () => {
    const done = group({ xp: 10_000 });
    const xp = done.challenges[0];
    let state = applyGroups(initialGroupsLocal(), [done]).state;
    expect(claimable(state, done).map((c) => c.id)).toEqual([xp.id]);
    state = { ...state, claimed: [claimKey(done.id, xp.id)] };
    expect(claimable(state, done)).toEqual([]);
    // A new week forgets last week's collected challenges.
    expect(applyGroups(state, [group({ week: NEXT_WEEK })]).state.claimed).toEqual([]);
  });
});

describe('storage and text', () => {
  it('survives broken storage', () => {
    expect(parseGroupsLocal('{nope')).toEqual(initialGroupsLocal());
    expect(parseGroupsLocal('{"notices":"x","readAt":5}')).toMatchObject({ notices: [], readAt: 5 });
  });

  it('says when a period ends', () => {
    const now = 0;
    expect(endsInText(null, now)).toBe('');
    expect(endsInText(30 * 60_000, now)).toBe('מסתיים בעוד פחות משעה');
    expect(endsInText(5 * 3600_000, now)).toBe('מסתיים בעוד 5 שעות');
    expect(endsInText(40 * 3600_000, now)).toBe('מסתיים בעוד 40 שעות');
    expect(endsInText(50 * 3600_000, now)).toBe('מסתיים בעוד יומיים');
    expect(endsInText(100 * 3600_000, now)).toBe('מסתיים בעוד 4 ימים');
    // A week that started 44 minutes ago.
    expect(endsInText(7 * 24 * 3600_000 - 44 * 60_000, now)).toBe('מסתיים בעוד 7 ימים');
  });
});
