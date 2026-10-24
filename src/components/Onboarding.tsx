import { useState } from 'react';
import { GOAL_OPTIONS } from '../lib/goals';
import { DAILY_GOAL_XP } from '../lib/progress';

/** How much English the learner says they know: 'some' goes on to the placement test. */
export type StartLevel = 'new' | 'some';

interface Props {
  onDone: (dailyGoal: number, level: StartLevel) => void;
  /** Omitted when accounts are disabled (static deploy). */
  onSignIn?: () => void;
}

/** First-run flow: a welcome screen, picking a daily XP goal, then where to start. */
export function Onboarding({ onDone, onSignIn }: Props) {
  const [step, setStep] = useState<'welcome' | 'goal' | 'level'>('welcome');
  const [goal, setGoal] = useState(DAILY_GOAL_XP);

  if (step === 'welcome') {
    return (
      <div className="onboarding">
        <img className="mascot pop" src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" />
        <h1>
          ברוכים הבאים ל־<bdi dir="ltr">Baktana English</bdi>!
        </h1>
        <p className="lead">לומדים אנגלית בכמה דקות ביום – בחינם, בכיף ובעברית.</p>
        <ul className="features">
          <li>🎯 שיעורים קצרים שנפתחים אחד אחרי השני</li>
          <li>🔊 שומעים כל מילה במבטא אמריקאי</li>
          <li>🔥 רצף ימים, נקודות XP{onSignIn && ' וליגה שבועית'}</li>
        </ul>
        <p className="privacy-note">אנחנו אוספים נתוני שימוש אנונימיים כדי לשפר את הקורס. אפשר לכבות בפרופיל.</p>
        <div className="onboarding-actions">
          <button type="button" className="btn primary" onClick={() => setStep('goal')} autoFocus>
            בואו נתחיל
          </button>
          {onSignIn && (
            <button type="button" className="btn ghost" onClick={onSignIn}>
              כבר יש לי חשבון
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'level') {
    return (
      <div className="onboarding">
        <h1>כמה אנגלית אתם כבר יודעים?</h1>
        <p className="lead">כדי שנתחיל מהמקום הנכון.</p>
        <div className="goal-options">
          <button type="button" className="goal-option level-option" onClick={() => onDone(goal, 'new')} autoFocus>
            <span className="goal-label">🌱 מתחילים מאפס</span>
            <span className="goal-hint">מתחילים מהשיעור הראשון</span>
          </button>
          <button type="button" className="goal-option level-option" onClick={() => onDone(goal, 'some')}>
            <span className="goal-label">📚 כבר יודעים קצת</span>
            <span className="goal-hint">מבחן מיקום קצר מדלג על מה שכבר יודעים</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <h1>מה היעד היומי שלכם?</h1>
      <p className="lead">אפשר לשנות את זה בכל רגע בפרופיל.</p>
      <div className="goal-options" role="radiogroup" aria-label="יעד יומי">
        {GOAL_OPTIONS.map((option) => (
          <button
            key={option.xp}
            type="button"
            role="radio"
            aria-checked={goal === option.xp}
            className={`goal-option${goal === option.xp ? ' selected' : ''}`}
            onClick={() => setGoal(option.xp)}
          >
            <span className="goal-label">{option.label}</span>
            <span className="goal-hint">{option.hint}</span>
            <span className="goal-xp" dir="ltr">
              {option.xp} XP
            </span>
          </button>
        ))}
      </div>
      <div className="onboarding-actions">
        <button type="button" className="btn primary" onClick={() => setStep('level')}>
          המשך
        </button>
      </div>
    </div>
  );
}
