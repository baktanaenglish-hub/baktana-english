import type { GameId, GemState } from '../lib/gems';
import { GAMES, REWARDED_PLAYS, gameUnlocked, playsToday, unlockProgress } from '../lib/games';
import type { Progress } from '../lib/progress';

interface Props {
  gems: GemState;
  progress: Progress;
  today: string;
  onPlay: (id: GameId) => void;
  onUnlock: (id: GameId) => void;
}

/** The arcade: games that open after a unit or for gems. */
export function Arcade({ gems, progress, today, onPlay, onUnlock }: Props) {
  return (
    <div className="arcade">
      <section className="arcade-head pop">
        <span className="arcade-big" aria-hidden="true">
          🎮
        </span>
        <div>
          <h2>ארקייד</h2>
          <span className="muted">
            משחקים עם המילים שכבר למדתם. {REWARDED_PLAYS} המשחקים הראשונים בכל יום מכל סוג נותנים יהלומים 💎
          </span>
        </div>
      </section>
      <div className="game-cards">
        {GAMES.map((game) => {
          const open = gameUnlocked(gems, progress, game.id);
          const steps = unlockProgress(progress, game);
          const plays = playsToday(gems, game.id, today);
          const best = gems.games.best[game.id];
          return (
            <section key={game.id} className={`game-card${open ? ' open' : ' locked'}`} data-game={game.id}>
              <span className="game-icon" aria-hidden="true">
                {open ? game.icon : '🔒'}
              </span>
              <div className="game-text">
                <h3>{game.title}</h3>
                <p className="muted">{game.description}</p>
                {open && (
                  <p className="game-meta">
                    🏆 שיא: {best} · 💎 פרסים היום: {Math.min(plays, REWARDED_PLAYS)}/{REWARDED_PLAYS}
                  </p>
                )}
                {!open && steps && (
                  <>
                    <p className="game-meta">
                      נפתח אחרי שמסיימים את כל השיעורים ביחידה 1 ({steps.done}/{steps.total})
                    </p>
                    <div className="progress-track small" aria-hidden="true">
                      <div className="progress-fill gem" style={{ width: `${(steps.done / steps.total) * 100}%` }} />
                    </div>
                  </>
                )}
              </div>
              {open ? (
                <button type="button" className="btn primary play-btn" onClick={() => onPlay(game.id)}>
                  שחקו!
                </button>
              ) : (
                'price' in game.unlock && (
                  <button
                    type="button"
                    className="btn secondary play-btn"
                    disabled={gems.gems < game.unlock.price}
                    onClick={() => onUnlock(game.id)}
                    aria-label={`פתיחת ${game.title} ב־${game.unlock.price} יהלומים`}
                    title={gems.gems < game.unlock.price ? 'אספו עוד יהלומים כדי לפתוח' : undefined}
                  >
                    🔓 💎 {game.unlock.price}
                  </button>
                )
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
