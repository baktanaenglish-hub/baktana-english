import { course } from '../data/course';

interface Props {
  /** Units the learner showed they know. */
  units: number;
  onContinue: () => void;
}

/** After the placement test: which unit the path now starts from. */
export function PlacementResult({ units, onContinue }: Props) {
  const next = course[units];
  return (
    <div className="lesson-complete">
      <div className="big-emoji pop" aria-hidden="true">
        {units > 0 ? '🎯' : '🌱'}
      </div>
      <h2>{units > 0 ? 'כל הכבוד!' : 'מתחילים מההתחלה'}</h2>
      <p className="lead">
        {units === 0 && 'נבנה יחד בסיס חזק – נתחיל מיחידה 1.'}
        {units > 0 && next && `דילגתם על ${units === 1 ? 'יחידה אחת' : `${units} יחידות`}. ממשיכים מ${next.title}.`}
        {units > 0 && !next && 'עברתם את כל היחידות! אפשר לחזור על כל שיעור ולהמשיך לתרגל.'}
      </p>
      {units > 0 && <p className="muted">המילים מהיחידות שדילגתם עליהן יופיעו בחזרה החכמה 🧠</p>}
      <button type="button" className="btn primary" onClick={onContinue} autoFocus>
        למסלול
      </button>
    </div>
  );
}
