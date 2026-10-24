import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry, User } from '../../shared/api';
import type { Period } from '../../shared/groups';
import { api, errorMessage } from '../lib/api';
import { endsInText } from '../lib/groups';
import { PeriodPicker } from './PeriodPicker';

interface Props {
  user: User | null;
  onSignIn: () => void;
  /** A guest's own XP, so the invitation shows where they would start. */
  guestXp?: number;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: LeaderboardEntry[]; endsAt: number | null };

export const MEDALS = ['🥇', '🥈', '🥉'];

const TITLES: Record<Period, string> = {
  week: '🏆 הליגה השבועית',
  month: '🏆 הליגה החודשית',
  all: '🏆 הדירוג המצטבר',
};

const SUBTITLES: Record<Period, string> = {
  week: 'דירוג לפי XP שנצבר השבוע (מיום ראשון)',
  month: 'דירוג לפי XP שנצבר החודש',
  all: 'דירוג לפי כל ה־XP שנצבר מאז ההצטרפות לליגה',
};

/** The personal XP league by week, month or all time. Guests can look and get an invitation to join. */
export function Leaderboard({ user, onSignIn, guestXp = 0 }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [period, setPeriod] = useState<Period>('week');

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    api.leaderboard(period).then(
      (res) => setState({ kind: 'ready', entries: res.entries, endsAt: res.endsAt ?? null }),
      (err) => setState({ kind: 'error', message: errorMessage(err) }),
    );
  }, [period]);

  useEffect(() => {
    // Anyone can view the league (US-B1 AC5); with a token the server also marks our row.
    load();
  }, [user, load]);

  const endsIn = state.kind === 'ready' ? endsInText(state.endsAt) : '';

  return (
    <div className="leaderboard">
      <h2>{TITLES[period]}</h2>
      <p className="muted">
        {SUBTITLES[period]}
        {endsIn && ` · ${endsIn}`}
      </p>
      <PeriodPicker value={period} onChange={setPeriod} label="תקופת הדירוג" />

      {!user && (
        <div className="panel center">
          {guestXp > 0 && (
            <p className="guest-xp">
              כבר צברתם <bdi dir="ltr">⭐ {guestXp} XP</bdi>!
            </p>
          )}
          <p>צרו פרופיל כדי להיכנס לליגה, להתחרות עם לומדים אחרים ולראות כמה XP צברתם השבוע.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            יצירת פרופיל
          </button>
        </div>
      )}

      {state.kind === 'loading' && (
        <ol className="board" aria-busy="true" aria-label="טוען דירוג">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="board-row skeleton" />
          ))}
        </ol>
      )}

      {state.kind === 'error' && (
        <div className="panel center">
          <p>📡 {state.message}</p>
          <button type="button" className="btn ghost" onClick={load}>
            נסו שוב
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length === 0 && user && (
        <div className="panel center">
          <p>עדיין אין אף אחד בדירוג הזה. סיימו שיעור ותהיו הראשונים!</p>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length > 0 && (
        <ol className="board">
          {state.entries.map((entry, i) => (
            <li
              key={`${entry.rank}-${entry.displayName}`}
              className={`board-row${entry.isMe ? ' me' : ''}${i > 0 && entry.rank > state.entries[i - 1].rank + 1 ? ' gap' : ''}`}
            >
              <span className="board-rank">{MEDALS[entry.rank - 1] ?? entry.rank}</span>
              <span className="board-avatar" aria-hidden="true">
                {entry.displayName.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="board-name" dir="auto">
                {entry.displayName}
                {entry.isMe && <span className="me-tag"> (אני)</span>}
              </span>
              <span className="board-xp" dir="ltr">
                {entry.weeklyXp} XP
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
