import { describe, expect, it } from 'vitest';
import {
  challengeStats,
  challengeStatus,
  cleanGroupName,
  groupRank,
  groupScore,
  inviteLink,
  newInviteCode,
  normalizeInviteCode,
  periodRange,
  previousPeriodRange,
  rankGroups,
  rankMembers,
  weeklyChallenges,
  zonedDateKey,
  type GroupTotals,
} from './groups';

const at = (iso: string) => Date.parse(iso);

describe('periods (Israel time)', () => {
  it('starts the week on Sunday at midnight in Israel, winter and summer', () => {
    // Wednesday 22 Oct 2026, 10:00 UTC (IDT, UTC+3).
    expect(periodRange('week', at('2026-10-22T10:00:00Z'))).toEqual({
      start: at('2026-10-17T21:00:00Z'),
      end: at('2026-10-24T21:00:00Z'),
    });
    // Tuesday 13 Jan 2026 (IST, UTC+2).
    expect(periodRange('week', at('2026-01-13T12:00:00Z')).start).toBe(at('2026-01-10T22:00:00Z'));
    // Saturday 23:30 in Israel is still the same week; Sunday 00:30 is the next one.
    const saturdayNight = at('2026-10-24T20:30:00Z');
    expect(periodRange('week', saturdayNight).start).toBe(at('2026-10-17T21:00:00Z'));
    expect(periodRange('week', at('2026-10-24T21:30:00Z')).start).toBe(at('2026-10-24T21:00:00Z'));
  });

  it('spans a week across the end of daylight saving time', () => {
    // Israel moves back to winter time on 25 Oct 2026.
    expect(periodRange('week', at('2026-10-26T10:00:00Z'))).toEqual({
      start: at('2026-10-24T21:00:00Z'),
      end: at('2026-10-31T22:00:00Z'),
    });
  });

  it('covers the calendar month, all time, and the period before', () => {
    expect(periodRange('month', at('2026-10-22T10:00:00Z'))).toEqual({
      start: at('2026-09-30T21:00:00Z'),
      end: at('2026-10-31T22:00:00Z'),
    });
    expect(periodRange('month', at('2026-12-31T23:00:00Z')).start).toBe(at('2026-12-31T22:00:00Z'));
    expect(periodRange('all')).toEqual({ start: 0, end: null });
    expect(previousPeriodRange('week', at('2026-10-22T10:00:00Z'))).toEqual({
      start: at('2026-10-10T21:00:00Z'),
      end: at('2026-10-17T21:00:00Z'),
    });
    expect(previousPeriodRange('month', at('2026-10-22T10:00:00Z'))?.start).toBe(at('2026-08-31T21:00:00Z'));
    expect(previousPeriodRange('all')).toBeNull();
  });

  it("gives Israel's calendar date", () => {
    expect(zonedDateKey(at('2026-10-22T21:30:00Z'))).toBe('2026-10-23');
    expect(zonedDateKey(at('2026-10-22T20:30:00Z'))).toBe('2026-10-22');
  });
});

describe('names and invite codes', () => {
  it('cleans group names', () => {
    expect(cleanGroupName('  המשפחה   שלנו ')).toBe('המשפחה שלנו');
    expect(cleanGroupName('א')).toBeNull();
    expect(cleanGroupName('x'.repeat(31))).toBeNull();
    expect(cleanGroupName(7)).toBeNull();
  });

  it('reads codes however they are typed, and makes readable ones', () => {
    expect(normalizeInviteCode(' abc-23x ')).toBe('ABC23X');
    expect(normalizeInviteCode('ABCD0O')).toBeNull();
    expect(normalizeInviteCode('ABC')).toBeNull();
    for (let i = 0; i < 50; i++) expect(normalizeInviteCode(newInviteCode())).not.toBeNull();
    expect(newInviteCode(() => 0)).toBe('AAAAAA');
  });

  it('builds the join link on the app address', () => {
    expect(inviteLink('https://example.com/app/?x=1#top', 'ABC234')).toBe('https://example.com/app/?join=ABC234');
  });
});

describe('fair group ranking', () => {
  const g = (id: string, memberCount: number, totalXp: number, isMine = false): GroupTotals => ({
    id,
    name: `group ${id}`,
    memberCount,
    totalXp,
    isMine,
  });

  it('scores by average XP per member, with small groups counted as three', () => {
    expect(groupScore(300, 10)).toBe(30);
    expect(groupScore(90, 1)).toBe(30);
    expect(groupScore(100, 3)).toBe(33);
  });

  it('ranks by score, then total XP, and keeps my groups below the top', () => {
    const rows = [g('a', 10, 300), g('b', 2, 120), g('c', 3, 90), g('d', 4, 0), g('e', 5, 50, true)];
    const ranked = rankGroups(rows, 2);
    expect(ranked.map((r) => [r.rank, r.name, r.score])).toEqual([
      [1, 'group b', 40],
      [2, 'group a', 30],
      [4, 'group e', 10],
    ]);
    expect(groupRank(rows, 'c')).toBe(3);
    expect(groupRank(rows, 'd')).toBeNull();
  });

  it('ranks members by XP, earliest member first on a tie', () => {
    const ranked = rankMembers([
      { displayName: 'late', xp: 10, isMe: false, isOwner: false, joinedAt: 2 },
      { displayName: 'early', xp: 10, isMe: true, isOwner: true, joinedAt: 1 },
      { displayName: 'top', xp: 30, isMe: false, isOwner: false, joinedAt: 3 },
    ]);
    expect(ranked.map((m) => m.displayName)).toEqual(['top', 'early', 'late']);
    expect(ranked[1]).toEqual({ rank: 2, displayName: 'early', xp: 10, isMe: true, isOwner: true });
  });
});

describe('weekly challenges', () => {
  const week = periodRange('week', at('2026-10-22T10:00:00Z')).start;

  it('scales goals with the group size and rotates them every week', () => {
    const one = weeklyChallenges(week, 1);
    const four = weeklyChallenges(week, 4);
    expect(four.map((c) => c.goal)).toEqual(one.map((c) => c.goal * 4));
    expect(one.map((c) => c.id)).toEqual([`xp:${week}`, `lessons:${week}`, `days:${week}`]);
    const next = weeklyChallenges(week + 7 * 24 * 3600 * 1000, 1);
    expect(next.map((c) => c.goal)).not.toEqual(one.map((c) => c.goal));
  });

  it('counts XP, lessons and member-days', () => {
    const day1 = at('2026-10-19T08:00:00Z');
    const stats = challengeStats([
      { userId: 'a', xp: 15, lesson: true, at: day1 },
      { userId: 'a', xp: 10, lesson: true, at: day1 + 3600_000 },
      { userId: 'b', xp: 10, lesson: false, at: day1 },
      { userId: 'a', xp: 10, lesson: true, at: day1 + 24 * 3600_000 },
    ]);
    expect(stats).toEqual({ xp: 45, lessons: 3, activeDays: 3 });
    const status = challengeStatus(weeklyChallenges(week, 1), { xp: 1000, lessons: 1, activeDays: 0 });
    expect(status.map((c) => c.done)).toEqual([true, false, false]);
    expect(status[0].progress).toBe(status[0].goal);
  });
});
