import { useState } from 'react';
import type { User } from '../../shared/api';
import type { DuelResult } from '../../shared/duels';
import type { DuelsState } from '../lib/duels';
import type { GroupsState } from '../lib/groups';
import { Duels } from './Duels';
import { GroupBoard } from './GroupBoard';
import { Leaderboard } from './Leaderboard';
import { MyGroups } from './MyGroups';

export type LeagueView = 'me' | 'groups' | 'mine' | 'duels';

interface Props {
  user: User | null;
  groups: GroupsState;
  duels: DuelsState;
  initialView?: LeagueView;
  onSignIn: () => void;
  /** See MyGroups: may return the pet's share of the prize. */
  onGems: (gems: number) => string | null | void;
  joinCode: string | null;
  onJoinCodeUsed: () => void;
  /** See Duels: may return the pet's share of the prize. */
  onDuelPrize: (result: DuelResult, gems: number) => string | null | void;
  duelCode: string | null;
  onDuelCodeUsed: () => void;
}

const VIEWS: { view: LeagueView; label: string }[] = [
  { view: 'me', label: '🏆 אישי' },
  { view: 'groups', label: '🏟️ קבוצות' },
  { view: 'mine', label: '👥 הקבוצות שלי' },
  { view: 'duels', label: '⚔️ ראש בראש' },
];

/** The league tab: the personal league, the group league, the learner's own groups and head-to-head duels. */
export function League({
  user,
  groups,
  duels,
  initialView = 'me',
  onSignIn,
  onGems,
  joinCode,
  onJoinCodeUsed,
  onDuelPrize,
  duelCode,
  onDuelCodeUsed,
}: Props) {
  const [view, setView] = useState<LeagueView>(initialView);
  return (
    <div className="league">
      <div className="league-tabs" role="tablist" aria-label="סוג הדירוג">
        {VIEWS.map(({ view: v, label }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'active' : ''}
            onClick={() => setView(v)}
          >
            {label}
            {v === 'mine' && groups.unread > 0 && view !== 'mine' && (
              <span className="badge" aria-label={`${groups.unread} התראות חדשות`}>
                {groups.unread}
              </span>
            )}
            {v === 'duels' && duels.unclaimed + duels.unread > 0 && view !== 'duels' && (
              <span className="badge" aria-label={`${duels.unclaimed + duels.unread} עדכונים בתחרויות`}>
                {duels.unclaimed + duels.unread}
              </span>
            )}
          </button>
        ))}
      </div>
      {view === 'me' && <Leaderboard user={user} onSignIn={onSignIn} />}
      {view === 'groups' && <GroupBoard user={user} />}
      {view === 'mine' && (
        <MyGroups
          user={user}
          state={groups}
          onSignIn={onSignIn}
          onGems={onGems}
          joinCode={joinCode}
          onJoinCodeUsed={onJoinCodeUsed}
        />
      )}
      {view === 'duels' && (
        <Duels
          user={user}
          state={duels}
          onSignIn={onSignIn}
          onPrize={onDuelPrize}
          duelCode={duelCode}
          onDuelCodeUsed={onDuelCodeUsed}
        />
      )}
    </div>
  );
}
