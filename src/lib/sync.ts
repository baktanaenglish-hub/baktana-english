import { refresh, type Progress } from './progress';

/**
 * Combines local progress with the copy the server returned, using the same
 * rules as the server (max xp, union of completed lessons with max count, the
 * later lastActiveDate with its streak). Hearts and the daily goal are
 * device-local, so they stay as they are locally.
 */
export function mergeProgress(local: Progress, server: Progress, now = Date.now()): Progress {
  // Progress was reset on another device (or this one, before the server had it): the newer reset wins.
  const localReset = local.resetAt ?? 0;
  const serverReset = server.resetAt ?? 0;
  if (serverReset > localReset) {
    return refresh(
      {
        ...server,
        hearts: local.hearts,
        heartsUpdatedAt: local.heartsUpdatedAt,
        dailyGoal: local.dailyGoal ?? server.dailyGoal,
      },
      now,
    );
  }
  if (localReset > serverReset) return refresh(local, now);
  const completed: Record<string, number> = { ...local.completed };
  for (const [id, count] of Object.entries(server.completed ?? {})) {
    completed[id] = Math.max(completed[id] ?? 0, count);
  }

  const localDate = local.lastActiveDate ?? '';
  const serverDate = server.lastActiveDate ?? '';
  let day: Pick<Progress, 'lastActiveDate' | 'streak' | 'xpToday'>;
  if (localDate === serverDate) {
    day = {
      lastActiveDate: local.lastActiveDate,
      streak: Math.max(local.streak, server.streak ?? 0),
      xpToday: Math.max(local.xpToday, server.xpToday ?? 0),
    };
  } else {
    const winner = localDate > serverDate ? local : server;
    day = { lastActiveDate: winner.lastActiveDate, streak: winner.streak ?? 0, xpToday: winner.xpToday ?? 0 };
  }

  return refresh(
    {
      ...local,
      ...day,
      xp: Math.max(local.xp, server.xp ?? 0),
      completed,
      dailyGoal: local.dailyGoal ?? server.dailyGoal,
    },
    now,
  );
}
