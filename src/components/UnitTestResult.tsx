import type { Reward } from '../lib/gems';
import type { Unit } from '../types';
import { RewardList } from './LessonComplete';
import { UNIT_TEST_PASS, UNIT_TEST_QUESTIONS, UNIT_TEST_XP } from '../lib/unit-test';

interface Props {
  unit: Unit;
  right: number;
  passed: boolean;
  /** Gems for a first pass. */
  rewards?: Reward[];
  onRetry: () => void;
  onContinue: () => void;
}

/** After an end-of-unit test: the score, a crown for a pass, or a try-again. */
export function UnitTestResult({ unit, right, passed, rewards = [], onRetry, onContinue }: Props) {
  return (
    <div className="lesson-complete">
      <div className="big-emoji pop" aria-hidden="true">
        {passed ? '👑' : '💪'}
      </div>
      <h2>{passed ? 'עברתם את מבחן היחידה!' : 'כמעט!'}</h2>
      <p className="lead">
        {right} מתוך {UNIT_TEST_QUESTIONS} נכונות
        {passed ? ` · +${UNIT_TEST_XP} XP` : ` – צריך ${UNIT_TEST_PASS} כדי לעבור.`}
      </p>
      <p className="muted">
        {passed ? `${unit.title} מקבלת כתר 👑` : 'אפשר לחזור על השיעורים של היחידה ולנסות שוב בכל זמן.'}
      </p>
      {rewards.length > 0 && <RewardList rewards={rewards} />}
      {!passed && (
        <button type="button" className="btn secondary" onClick={onRetry}>
          לנסות שוב
        </button>
      )}
      <button type="button" className="btn primary" onClick={onContinue} autoFocus>
        למסלול
      </button>
    </div>
  );
}
