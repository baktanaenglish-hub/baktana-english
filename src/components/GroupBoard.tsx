import { useCallback, useEffect, useState } from 'react';
import type { GroupLeaderboardResponse, User } from '../../shared/api';
import { FAIR_GROUP_SIZE, type Period } from '../../shared/groups';
import { api, errorMessage } from '../lib/api';
import { endsInText } from '../lib/groups';
import { MEDALS } from './Leaderboard';
import { PeriodPicker } from './PeriodPicker';

interface Props {
  user: User | null;
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & GroupLeaderboardResponse);

const COMPETITION: Record<Period, string> = {
  week: 'תחרות השבוע',
  month: 'תחרות החודש',
  all: 'הדירוג המצטבר',
};

const PREVIOUS: Record<Period, string> = { week: 'המנצחות של השבוע שעבר', month: 'המנצחות של החודש שעבר', all: '' };

/** Groups ranked by average XP per member, by week, month or all time. */
export function GroupBoard({ user }: Props) {
  const [period, setPeriod] = useState<Period>('week');
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    api.groupLeaderboard(period).then(
      (res) => setState({ kind: 'ready', ...res }),
      (err) => setState({ kind: 'error', message: errorMessage(err) }),
    );
  }, [period]);

  useEffect(() => {
    load();
  }, [user, load]);

  const endsIn = state.kind === 'ready' ? endsInText(state.endsAt) : '';

  return (
    <div className="group-board">
      <h2>🏟️ דירוג הקבוצות</h2>
      <p className="muted">
        {COMPETITION[period]}
        {endsIn && ` · ${endsIn}`}
      </p>
      <PeriodPicker value={period} onChange={setPeriod} label="תקופת דירוג הקבוצות" />
      <p className="muted fair-note">
        ⚖️ הדירוג לפי ממוצע XP לחבר/ה, כך שקבוצה קטנה יכולה לנצח קבוצה גדולה. קבוצה של פחות מ־{FAIR_GROUP_SIZE} נספרת
        כאילו יש בה {FAIR_GROUP_SIZE}.
      </p>

      {state.kind === 'loading' && (
        <ol className="board" aria-busy="true" aria-label="טוען דירוג">
          {[0, 1, 2].map((i) => (
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

      {state.kind === 'ready' && state.previousWinners.length > 0 && (
        <div className="panel winners">
          <h3>🏅 {PREVIOUS[period]}</h3>
          <ol className="winner-list">
            {state.previousWinners.map((w) => (
              <li key={`${w.rank}-${w.name}`} className={w.isMine ? 'mine' : ''}>
                <span aria-hidden="true">{MEDALS[w.rank - 1]}</span> <span dir="auto">{w.name}</span>
                {w.isMine && <span className="me-tag"> (הקבוצה שלי)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length === 0 && (
        <div className="panel center">
          <p>אף קבוצה עוד לא צברה XP בתקופה הזאת. צרו קבוצה, הזמינו חברים ותהיו הראשונים!</p>
        </div>
      )}

      {state.kind === 'ready' && state.entries.length > 0 && (
        <ol className="board">
          {state.entries.map((entry, i) => (
            <li
              key={`${entry.rank}-${entry.name}`}
              className={`board-row${entry.isMine ? ' me' : ''}${i > 0 && entry.rank > state.entries[i - 1].rank + 1 ? ' gap' : ''}`}
            >
              <span className="board-rank">{MEDALS[entry.rank - 1] ?? entry.rank}</span>
              <span className="board-avatar" aria-hidden="true">
                👥
              </span>
              <span className="board-name" dir="auto">
                {entry.name}
                {entry.isMine && <span className="me-tag"> (שלי)</span>}
                <span className="board-sub">
                  {entry.memberCount === 1 ? 'חבר/ה אחד/ת' : `${entry.memberCount} חברים`} · {entry.totalXp} XP
                </span>
              </span>
              <span className="board-xp" dir="ltr" title="ממוצע XP לחבר/ה">
                {entry.score} XP
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
