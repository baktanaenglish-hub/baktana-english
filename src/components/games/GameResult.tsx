import { useEffect } from 'react';
import type { Reward } from '../../lib/gems';
import { REWARDED_PLAYS } from '../../lib/games';
import { sounds } from '../../lib/sound';
import { RewardList } from '../LessonComplete';

interface Props {
  title: string;
  score: number;
  best: number;
  record: boolean;
  rewards: Reward[];
  onAgain: () => void;
  onBack: () => void;
}

/** After an arcade game: the score, a new record, and the gems it paid. */
export function GameResult({ title, score, best, record, rewards, onAgain, onBack }: Props) {
  useEffect(() => {
    sounds.complete();
  }, []);

  return (
    <div className="lesson-complete game-result">
      <div className="big-emoji pop" aria-hidden="true">
        {record ? '🏆' : '🎮'}
      </div>
      <h2 className="pop" role="status">
        {record ? 'שיא חדש!' : `${title} – סוף המשחק`}
      </h2>
      <div className="stat-cards">
        <div className="stat-card xp rise">
          <span className="label">ניקוד</span>
          <span className="value">⭐ {score}</span>
        </div>
        <div className="stat-card streak rise" style={{ animationDelay: '0.1s' }}>
          <span className="label">שיא</span>
          <span className="value">🏆 {best}</span>
        </div>
      </div>
      {rewards.length > 0 ? (
        <RewardList rewards={rewards} />
      ) : (
        <p className="muted">היום כבר קיבלתם פרסים על {REWARDED_PLAYS} משחקים – עכשיו משחקים בשביל השיא 😉</p>
      )}
      <button type="button" className="btn secondary" onClick={onAgain}>
        🔁 עוד סיבוב
      </button>
      <button type="button" className="btn primary" onClick={onBack} autoFocus>
        חזרה למשחקים
      </button>
    </div>
  );
}
