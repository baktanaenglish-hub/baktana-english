import { useEffect, type ReactNode } from 'react';
import type { Reward } from '../lib/gems';
import { sounds } from '../lib/sound';
import type { LessonResult } from './LessonScreen';

interface Props {
  result: LessonResult;
  streak: number;
  /** True when this lesson took today's XP across the daily goal. */
  goalReached?: boolean;
  /** A lesson, a spaced-repetition review, or a review made of random practice. */
  kind?: 'lesson' | 'review' | 'practice';
  /** Optional sign-up card (guests only, docs/spec/v2.md §7.4). */
  signupPrompt?: ReactNode;
  /** Gems earned by this session. */
  rewards?: Reward[];
  /** The learner's pet reacting to the session. */
  pet?: ReactNode;
  onContinue: () => void;
}

const TITLES = { lesson: 'השיעור הושלם!', review: 'החזרה הושלמה!', practice: 'התרגול הושלם!' };
const EMOJIS = { lesson: '🎉', review: '🧠', practice: '💪' };

const CONFETTI_COLORS = ['#1f7cf2', '#00a99d', '#ffc21a', '#ff4b4b', '#ce82ff', '#ff9600'];

export function LessonComplete({
  result,
  streak,
  goalReached = false,
  kind = 'lesson',
  signupPrompt,
  rewards = [],
  pet,
  onContinue,
}: Props) {
  useEffect(() => {
    sounds.complete();
  }, []);
  const gems = rewards.reduce((sum, r) => sum + r.gems, 0);

  return (
    <div className="lesson-complete">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i
            key={i}
            style={{
              insetInlineStart: `${(i * 37) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 8) * 0.12}s`,
              animationDuration: `${1.8 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>
      <div className="big-emoji pop" aria-hidden="true">
        {EMOJIS[kind]}
      </div>
      <h2 className="pop" role="status">
        {TITLES[kind]}
      </h2>
      {goalReached && <p className="goal-banner pop">🎯 עמדתם ביעד היומי! כל הכבוד!</p>}
      {pet}
      <div className="stat-cards">
        <div className="stat-card xp rise" style={{ animationDelay: '0.1s' }}>
          <span className="label">נקודות XP</span>
          <span className="value">⚡ +{result.xp}</span>
        </div>
        <div className="stat-card accuracy rise" style={{ animationDelay: '0.2s' }}>
          <span className="label">דיוק</span>
          <span className="value">🎯 {result.accuracy}%</span>
        </div>
        <div className="stat-card streak rise" style={{ animationDelay: '0.3s' }}>
          <span className="label">רצף ימים</span>
          <span className="value">🔥 {streak}</span>
        </div>
        {gems > 0 && (
          <div className="stat-card gems rise" style={{ animationDelay: '0.4s' }}>
            <span className="label">יהלומים</span>
            <span className="value">💎 +{gems}</span>
          </div>
        )}
      </div>
      {rewards.length > 0 && <RewardList rewards={rewards} />}
      {signupPrompt}
      <button type="button" className="btn primary" onClick={onContinue} autoFocus>
        המשך
      </button>
    </div>
  );
}

/** What the gems were for, one line each. */
export function RewardList({ rewards }: { rewards: Reward[] }) {
  return (
    <ul className="reward-list" aria-label="יהלומים שהרווחתם">
      {rewards.map((r, i) => (
        <li key={i} className="rise" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
          <span aria-hidden="true">{r.icon}</span>
          <span className="reward-label">{r.label}</span>
          <span className="reward-gems">💎 +{r.gems}</span>
        </li>
      ))}
    </ul>
  );
}
