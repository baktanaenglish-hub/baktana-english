/**
 * The learner's side of groups: notices about their groups (new challenges, shared achievements,
 * rank changes, new members) and the gems for completed challenges. Notices come from comparing
 * each fresh GET /api/groups with the last one seen on this device; the Android app also shows them
 * as system notifications. Kept in localStorage, like gems.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useCallback, useEffect, useState } from 'react';
import type { GroupSummary } from '../../shared/groups';
import { api, errorMessage } from './api';

export const GROUPS_KEY = 'baktana-english:groups:v1';
/** Notices kept in the feed. */
export const MAX_NOTICES = 30;
/** A rank change of at least this many places is worth a notice (any change into the top 3 is). */
export const RANK_JUMP = 3;

export type NoticeKind = 'challenges' | 'achievement' | 'rank' | 'members';

export interface GroupNotice {
  id: string;
  kind: NoticeKind;
  groupId: string;
  icon: string;
  text: string;
  at: number;
}

/** What was last seen of a group, to tell what changed since. */
export interface GroupSnapshot {
  weekStart: number;
  weekRank: number | null;
  memberCount: number;
  done: string[];
}

export interface GroupsLocal {
  snapshots: Record<string, GroupSnapshot>;
  notices: GroupNotice[];
  /** Notices up to this time have been seen. */
  readAt: number;
  /** Challenge ids (`${groupId}|${challengeId}`) whose gems were collected. */
  claimed: string[];
}

export function initialGroupsLocal(): GroupsLocal {
  return { snapshots: {}, notices: [], readAt: 0, claimed: [] };
}

export function parseGroupsLocal(raw: string | null): GroupsLocal {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<GroupsLocal>) : null;
    if (!v || typeof v !== 'object') return initialGroupsLocal();
    return {
      snapshots: v.snapshots && typeof v.snapshots === 'object' ? v.snapshots : {},
      notices: Array.isArray(v.notices) ? v.notices.slice(0, MAX_NOTICES) : [],
      readAt: typeof v.readAt === 'number' ? v.readAt : 0,
      claimed: Array.isArray(v.claimed) ? v.claimed.filter((c) => typeof c === 'string') : [],
    };
  } catch {
    return initialGroupsLocal();
  }
}

/** Each learner signed in on the device keeps their own notices. */
const storageKey = (userId: string) => `${GROUPS_KEY}:${userId}`;

export function loadGroupsLocal(userId: string): GroupsLocal {
  try {
    return parseGroupsLocal(localStorage.getItem(storageKey(userId)));
  } catch {
    return initialGroupsLocal();
  }
}

export function saveGroupsLocal(userId: string, state: GroupsLocal) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Storage unavailable – notices just show again next time.
  }
}

export function snapshotOf(g: GroupSummary): GroupSnapshot {
  return {
    weekStart: g.weekStart,
    weekRank: g.weekRank,
    memberCount: g.memberCount,
    done: g.challenges.filter((c) => c.done).map((c) => c.id),
  };
}

/** What changed in one group since `prev` (nothing for a group seen for the first time). */
export function groupNotices(prev: GroupSnapshot | undefined, g: GroupSummary, now = Date.now()): GroupNotice[] {
  if (!prev) return [];
  const notices: GroupNotice[] = [];
  const add = (kind: NoticeKind, key: string, icon: string, text: string) =>
    notices.push({ id: `${g.id}|${kind}|${key}`, kind, groupId: g.id, icon, text, at: now });

  if (g.weekStart !== prev.weekStart) {
    add(
      'challenges',
      String(g.weekStart),
      '🎯',
      `שבוע חדש ב„${g.name}”: ${g.challenges.length} אתגרים חדשים מחכים לכם`,
    );
  } else {
    for (const c of g.challenges) {
      if (c.done && !prev.done.includes(c.id)) {
        add('achievement', c.id, '🎉', `„${g.name}” השלימה את האתגר: ${c.title}! אספו ${c.gems} 💎`);
      }
    }
    const before = prev.weekRank;
    const after = g.weekRank;
    if (after !== null && before !== null && after !== before) {
      const big = Math.abs(after - before) >= RANK_JUMP || (after <= 3 && before > 3) || (before <= 3 && after > 3);
      if (big) {
        add(
          'rank',
          `${g.weekStart}:${after}`,
          after < before ? '📈' : '📉',
          after < before
            ? `„${g.name}” עלתה למקום ${after} בדירוג הקבוצות השבועי`
            : `„${g.name}” ירדה למקום ${after} בדירוג הקבוצות. זה הזמן לשיעור!`,
        );
      }
    } else if (after !== null && before === null && after <= 3) {
      add('rank', `${g.weekStart}:${after}`, '🏆', `„${g.name}” נכנסה למקום ${after} בדירוג הקבוצות השבועי`);
    }
  }
  const joined = g.memberCount - prev.memberCount;
  if (joined > 0) {
    add(
      'members',
      `${g.memberCount}:${now}`,
      '👋',
      joined === 1 ? `חבר/ה חדש/ה הצטרף/ה ל„${g.name}”` : `${joined} חברים חדשים הצטרפו ל„${g.name}”`,
    );
  }
  return notices;
}

/** Applies a fresh list of the learner's groups: new notices first, snapshots replaced. */
export function applyGroups(
  state: GroupsLocal,
  groups: GroupSummary[],
  now = Date.now(),
): { state: GroupsLocal; fresh: GroupNotice[] } {
  const known = new Set(state.notices.map((n) => n.id));
  const fresh = groups.flatMap((g) => groupNotices(state.snapshots[g.id], g, now)).filter((n) => !known.has(n.id));
  const ids = new Set(groups.map((g) => g.id));
  return {
    state: {
      ...state,
      snapshots: Object.fromEntries(groups.map((g) => [g.id, snapshotOf(g)])),
      notices: [...fresh, ...state.notices.filter((n) => ids.has(n.groupId))].slice(0, MAX_NOTICES),
      // Only this week's challenges can still be collected.
      claimed: state.claimed.filter((key) =>
        groups.some((g) => key.startsWith(`${g.id}|`) && key.endsWith(`:${g.weekStart}`)),
      ),
    },
    fresh,
  };
}

export function unreadCount(state: GroupsLocal): number {
  return state.notices.filter((n) => n.at > state.readAt).length;
}

export const claimKey = (groupId: string, challengeId: string) => `${groupId}|${challengeId}`;

/** Completed challenges of this week whose gems this learner hasn't collected yet. */
export function claimable(state: GroupsLocal, g: GroupSummary) {
  return g.challenges.filter((c) => c.done && !state.claimed.includes(claimKey(g.id, c.id)));
}

const NOTICE_FIRST_ID = 2001;
const NOTICE_SLOTS = 20;

/** Android: shows fresh notices as system notifications (the web shows them in the app only). */
export async function notifyGroupNotices(notices: GroupNotice[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || notices.length === 0) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    const at = new Date(Date.now() + 1000);
    await LocalNotifications.schedule({
      notifications: notices.slice(0, 5).map((n, i) => ({
        id: NOTICE_FIRST_ID + ((Math.floor(n.at / 1000) + i) % NOTICE_SLOTS),
        title: `${n.icon} הקבוצה שלך`,
        body: n.text,
        schedule: { at, allowWhileIdle: true },
        smallIcon: 'ic_stat_notify',
      })),
    });
  } catch {
    // Notifications unavailable – the notices are still in the app.
  }
}

export interface GroupsState {
  /** null until the first answer (or while signed out). */
  groups: GroupSummary[] | null;
  error: string | null;
  local: GroupsLocal;
  unread: number;
  refresh: () => Promise<void>;
  markRead: () => void;
  /** Collects a completed challenge's gems once; returns the gems, or 0 when not collectable. */
  claim: (groupId: string, challengeId: string) => number;
}

/** The signed-in learner's groups, refreshed on sign-in and whenever `refresh` is called. */
export function useGroups(userId: string | null): GroupsState {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<GroupsLocal>(initialGroupsLocal);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.groups();
      const applied = applyGroups(loadGroupsLocal(userId), res.groups);
      saveGroupsLocal(userId, applied.state);
      setLocal(applied.state);
      setGroups(res.groups);
      setError(null);
      void notifyGroupNotices(applied.fresh);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [userId]);

  useEffect(() => {
    setGroups(null);
    setError(null);
    setLocal(userId ? loadGroupsLocal(userId) : initialGroupsLocal());
    void refresh();
  }, [userId, refresh]);

  const markRead = useCallback(() => {
    if (!userId) return;
    setLocal((s) => {
      const next = { ...s, readAt: Date.now() };
      saveGroupsLocal(userId, next);
      return next;
    });
  }, [userId]);

  const claim = useCallback(
    (groupId: string, challengeId: string) => {
      const challenge = groups?.find((g) => g.id === groupId)?.challenges.find((c) => c.id === challengeId);
      const key = claimKey(groupId, challengeId);
      if (!userId || !challenge?.done || local.claimed.includes(key)) return 0;
      const next = { ...local, claimed: [...local.claimed, key] };
      saveGroupsLocal(userId, next);
      setLocal(next);
      return challenge.gems;
    },
    [userId, groups, local],
  );

  return { groups, error, local, unread: unreadCount(local), refresh, markRead, claim };
}

/** "Ends in …" for a period's end (ms), or '' for all time. */
export function endsInText(endsAt: number | null | undefined, now = Date.now()): string {
  if (!endsAt) return '';
  const hours = Math.max(0, Math.ceil((endsAt - now) / 3_600_000));
  if (hours <= 48) return hours <= 1 ? 'מסתיים בעוד פחות משעה' : `מסתיים בעוד ${hours} שעות`;
  // Whole days left, rounded down: a week that just began ends "in 7 days", not 8.
  const days = Math.floor(hours / 24);
  return days === 2 ? 'מסתיים בעוד יומיים' : `מסתיים בעוד ${days} ימים`;
}

/** Reads `?join=CODE` from the address (a shared invite link) and removes it from the address bar. */
export function takeJoinCode(): string | null {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('join');
    if (!code) return null;
    url.searchParams.delete('join');
    window.history.replaceState(window.history.state, '', url.href);
    return code;
  } catch {
    return null;
  }
}
