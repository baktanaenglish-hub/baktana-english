import { useState } from 'react';
import { QUESTS, chestAvailable, nextChestStreak, type GemState } from '../lib/gems';

interface Props {
  gems: GemState;
  today: string;
  /** Opens today's chest and returns how many gems were in it. */
  onOpenChest: () => number | null;
}

/** The daily chest and today's quests, at the top of the path. */
export function DailyRewards({ gems, today, onOpenChest }: Props) {
  const [opened, setOpened] = useState<number | null>(null);
  /** The quest list folds into one line, so the path's first lesson isn't pushed off the screen. */
  const [showQuests, setShowQuests] = useState(false);
  const available = chestAvailable(gems, today);
  const quests = gems.questDate === today ? gems.quests : { lessons: 0, perfect: 0, review: 0 };
  const claimed = gems.questDate === today ? gems.claimed : [];
  const doneCount = QUESTS.filter((q) => claimed.includes(q.id)).length;

  return (
    <section className="daily-rewards" aria-label="פרסים יומיים">
      <div className={`chest-row${available ? ' ready' : ''}`}>
        <button
          type="button"
          className={`chest-btn${available ? ' ready' : ''}${opened !== null ? ' opened' : ''}`}
          disabled={!available}
          onClick={() => setOpened(onOpenChest())}
          aria-label={available ? 'פתיחת התיבה היומית' : 'התיבה היומית כבר נפתחה היום'}
        >
          <span aria-hidden="true">{available ? '🎁' : '📦'}</span>
        </button>
        <div className="chest-text" role="status">
          {opened !== null ? (
            <strong className="pop">
              קיבלתם <span className="gem-amount">💎 {opened}</span>!
            </strong>
          ) : available ? (
            <>
              <strong>התיבה היומית מחכה לכם!</strong>
              <span className="muted">
                {nextChestStreak(gems, today) > 1
                  ? `יום ${nextChestStreak(gems, today)} ברצף – תיבה גדולה יותר`
                  : 'פתחו כל יום והתיבה תגדל'}
              </span>
            </>
          ) : (
            <>
              <strong>חזרו מחר לתיבה הבאה</strong>
              <span className="muted">יום {gems.chestStreak} ברצף 🔥</span>
            </>
          )}
        </div>
      </div>
      <h3 className="quests-title">
        <button
          type="button"
          className="quests-toggle"
          aria-expanded={showQuests}
          aria-controls="daily-quests"
          onClick={() => setShowQuests((v) => !v)}
        >
          <span>⚡ משימות יומיות</span>
          <span className="quests-count">
            {doneCount}/{QUESTS.length} {showQuests ? '▴' : '▾'}
          </span>
        </button>
      </h3>
      <ul className="quests" id="daily-quests" hidden={!showQuests}>
        {QUESTS.map((quest) => {
          const done = claimed.includes(quest.id);
          const value = Math.min(quest.goal, quests[quest.id]);
          return (
            <li key={quest.id} className={done ? 'done' : ''}>
              <span className="quest-icon" aria-hidden="true">
                {done ? '✅' : quest.icon}
              </span>
              <div className="quest-body">
                <div className="quest-head">
                  <span>{quest.title}</span>
                  <span className="quest-gems">💎 {quest.gems}</span>
                </div>
                <div
                  className="progress-track small"
                  role="progressbar"
                  aria-label={quest.title}
                  aria-valuemin={0}
                  aria-valuemax={quest.goal}
                  aria-valuenow={value}
                >
                  <div className="progress-fill gem" style={{ width: `${(value / quest.goal) * 100}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
