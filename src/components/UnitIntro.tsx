import { useEffect } from 'react';
import type { Unit } from '../types';
import { RichTip } from './RichTip';

interface Props {
  unit: Unit;
  /** 'auto' opens before the unit's first lesson and starts it; 'button' only shows the tip. */
  trigger: 'auto' | 'button';
  /** "יאללה, מתחילים" (auto) or "הבנתי" (button). */
  onConfirm: () => void;
  /** ✕, Escape or a tap outside the sheet. */
  onClose: () => void;
}

/** Bottom sheet with a unit's level, goals and opening tip (docs/spec/v2.md §7.3). */
export function UnitIntro({ unit, trigger, onConfirm, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titleId = `intro-${unit.id}`;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet unit-intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopColor: unit.color }}
      >
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="סגירה">
          ✕
        </button>
        <div className="sheet-head">
          <span className="intro-icon" aria-hidden="true" style={{ background: unit.color }}>
            📖
          </span>
          <div>
            <h2 id={titleId}>{unit.title}</h2>
            {unit.level && (
              <span className="level-chip" dir="ltr">
                {unit.level}
              </span>
            )}
          </div>
        </div>
        {unit.intro?.goals && unit.intro.goals.length > 0 && (
          <>
            <h3>ביחידה הזאת תלמדו</h3>
            <ul className="intro-goals">
              {unit.intro.goals.map((goal) => (
                <li key={goal}>
                  <RichTip text={goal} inline />
                </li>
              ))}
            </ul>
          </>
        )}
        {unit.intro && (
          <div className="tip-box">
            <span className="tip-label">💡 טיפ</span>
            <RichTip text={unit.intro.tip} />
          </div>
        )}
        <button type="button" className="btn primary wide" onClick={onConfirm} autoFocus>
          {trigger === 'auto' ? 'יאללה, מתחילים' : 'הבנתי'}
        </button>
      </div>
    </div>
  );
}
