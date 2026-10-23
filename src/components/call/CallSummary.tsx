import { useEffect, useRef } from 'react';
import type { Correction, Persona } from '../../../shared/call';
import { formatDuration } from '../../lib/call';
import { PersonaPortrait } from './PersonaPortrait';
import { personaStyle } from './persona-style';

export interface CallResult {
  persona: Persona;
  durationMs: number;
  turns: number;
  corrections: Correction[];
}

interface Props {
  result: CallResult;
  onNewCall: () => void;
  onBack: () => void;
}

function encouragement(turns: number): string {
  if (turns === 0) return 'בפעם הבאה נסו להגיד משהו – אפילו משפט אחד זה התחלה מצוינת!';
  if (turns < 4) return 'התחלה טובה! כל משפט באנגלית מקרב אתכם לדבר בביטחון.';
  if (turns < 10) return 'כל הכבוד! ניהלתם שיחה של ממש באנגלית.';
  return 'וואו, איזו שיחה! אתם כבר מדברים אנגלית בביטחון.';
}

/** After hanging up: how long the call was, how much the learner said and what the teacher fixed. */
export function CallSummary({ result, onNewCall, onBack }: Props) {
  const { persona, durationMs, turns, corrections } = result;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="call-summary">
      <div className="call-summary-avatar" style={personaStyle(persona.color)} aria-hidden="true">
        <PersonaPortrait persona={persona} />
      </div>
      <h1 ref={heading} tabIndex={-1}>
        השיחה עם <span dir="ltr">{persona.name}</span> הסתיימה
      </h1>
      <p className="call-summary-cheer">{encouragement(turns)}</p>

      <div className="call-stats">
        <div className="call-stat">
          <span className="call-stat-value" dir="ltr">
            {formatDuration(durationMs)}
          </span>
          <span className="call-stat-label">משך השיחה</span>
        </div>
        <div className="call-stat">
          <span className="call-stat-value">{turns}</span>
          <span className="call-stat-label">משפטים שאמרתם</span>
        </div>
      </div>

      {persona.corrects && (
        <section className="call-learned" aria-labelledby="call-learned-title">
          <h2 id="call-learned-title">📝 מה למדנו</h2>
          {corrections.length === 0 ? (
            <p className="muted">לא היו תיקונים הפעם – מעולה!</p>
          ) : (
            <ul>
              {corrections.map((c, i) => (
                <li key={i}>
                  <CorrectionView correction={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="call-summary-actions">
        <button type="button" className="btn primary" onClick={onNewCall}>
          שיחה חדשה
        </button>
        <button type="button" className="btn ghost" onClick={onBack}>
          חזרה
        </button>
      </div>
    </div>
  );
}

/** A teacher's correction: the struck original, the corrected sentence and the Hebrew explanation. */
export function CorrectionView({ correction }: { correction: Correction }) {
  return (
    <div className="correction">
      <p className="correction-line" dir="ltr">
        <del aria-label={`במקום: ${correction.original}`}>{correction.original}</del>
        <span aria-hidden="true"> → </span>
        <ins aria-label={`עדיף: ${correction.corrected}`}>{correction.corrected}</ins>
      </p>
      {correction.explanationHe && <p className="correction-why">{correction.explanationHe}</p>}
    </div>
  );
}
