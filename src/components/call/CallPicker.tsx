import { useCallback, useEffect, useState } from 'react';
import type { User } from '../../../shared/api';
import { PERSONAS, TESTER_LIMITS, type CallStatusResponse, type Persona } from '../../../shared/call';
import { ApiRequestError, errorMessage } from '../../lib/api';
import { callsLeft, remainingText } from '../../lib/call';
import { getCallStatus } from '../../lib/call-api';
import { canListen } from '../../lib/listen';
import { PersonaPortrait } from './PersonaPortrait';
import { personaStyle } from './persona-style';

interface Props {
  user: User | null;
  /** The last known status (kept by App), shown while a fresh one loads. */
  status: CallStatusResponse | null;
  onStatus: (status: CallStatusResponse | null) => void;
  onSignIn: () => void;
  onCall: (persona: Persona) => void;
  /** Opens the premium screen; omitted until premium is on sale ("coming soon"). */
  onPremium?: () => void;
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'signed-out' } | { kind: 'ready' };

/**
 * The "call" tab: pick an AI character to talk to. Calls are for signed-in premium learners;
 * everyone else sees the characters as a teaser.
 */
export function CallPicker({ user, status, onStatus, onSignIn, onCall, onPremium }: Props) {
  const [load, setLoad] = useState<Load>(user ? { kind: 'loading' } : { kind: 'signed-out' });

  const fetchStatus = useCallback(
    (signal?: AbortSignal) => {
      setLoad({ kind: 'loading' });
      getCallStatus(signal).then(
        (res) => {
          if (signal?.aborted) return;
          onStatus(res);
          setLoad({ kind: 'ready' });
        },
        (err) => {
          if (signal?.aborted) return;
          if (err instanceof ApiRequestError && err.unauthorized) {
            onStatus(null);
            setLoad({ kind: 'signed-out' });
          } else setLoad({ kind: 'error', message: errorMessage(err) });
        },
      );
    },
    [onStatus],
  );

  useEffect(() => {
    if (!user) {
      setLoad({ kind: 'signed-out' });
      return;
    }
    const controller = new AbortController();
    fetchStatus(controller.signal);
    return () => controller.abort();
  }, [user, fetchStatus]);

  // While refreshing, the last known status keeps the screen steady.
  const shown = load.kind === 'signed-out' ? null : status;
  const left = shown ? callsLeft(shown) : 0;
  /** Premium learners, and testers on their short daily trial. */
  const allowed = shown !== null && (shown.premium || shown.tester === true);
  const canCall = allowed && left > 0 && load.kind !== 'error';
  const skeleton = load.kind === 'loading' && !shown;

  return (
    <div className="call-picker">
      <h2>📞 שיחת וידאו באנגלית</h2>
      <p className="muted">בחרו דמות, התקשרו ודברו איתה באנגלית – כמו בשיחה אמיתית.</p>

      {load.kind === 'signed-out' && (
        <div className="panel center call-gate">
          <p>
            <span aria-hidden="true">⭐ </span>
            שיחות וידאו זמינות למנויי פרימיום. התחברו כדי להמשיך
          </p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            התחברות
          </button>
        </div>
      )}

      {load.kind === 'error' && (
        <div className="panel center call-gate" role="alert">
          <p>📡 {load.message}</p>
          <button type="button" className="btn ghost" onClick={() => fetchStatus()}>
            נסו שוב
          </button>
        </div>
      )}

      {load.kind !== 'error' && shown && !allowed && (
        <div className="panel center call-gate locked">
          {onPremium ? (
            <>
              <p className="call-gate-title">🔒 שיחות וידאו הן חלק מפרימיום</p>
              <p className="muted">הכירו את הדמויות שמחכות לכם, והצטרפו כדי לדבר איתן.</p>
              <button type="button" className="btn secondary" onClick={onPremium}>
                👑 לפרטים על פרימיום
              </button>
            </>
          ) : (
            <>
              <p className="call-gate-title">🔒 בקרוב! שיחות וידאו יהיו חלק מפרימיום</p>
              <p className="muted">בינתיים אפשר להכיר את הדמויות שמחכות לכם.</p>
            </>
          )}
        </div>
      )}

      {load.kind !== 'error' && shown && allowed && left === 0 && (
        <div className="panel center call-gate limit" role="status">
          <p className="call-gate-title">
            {shown.callsPerDay === 1 ? 'השיחה של היום כבר נוצלה.' : `הגעתם ל־${shown.callsPerDay} שיחות היום.`} נתראה
            מחר! <span aria-hidden="true">🌙</span>
          </p>
        </div>
      )}

      {load.kind !== 'error' && shown?.tester && left > 0 && (
        <p className="calls-left" role="status">
          <span aria-hidden="true">🧪 </span>
          שיחת ניסיון לבודקים: שיחה אחת ביום, עד {TESTER_LIMITS.maxTurns} משפטים
        </p>
      )}

      {load.kind !== 'error' && shown?.premium && left > 0 && (
        <p className="calls-left" role="status">
          <span aria-hidden="true">📞 </span>
          {remainingText(left, shown.callsPerDay)}
        </p>
      )}

      <p className="call-notice" role="note">
        <span aria-hidden="true">🤖</span>
        <span>הדמויות הן בינה מלאכותית, לא אנשים אמיתיים. אל תשתפו פרטים אישיים.</span>
      </p>

      {canCall && !canListen && (
        <p className="call-notice warn" role="note">
          <span aria-hidden="true">🎤</span>
          <span>כדי לדבר בקול צריך את האפליקציה או דפדפן Chrome. כאן אפשר לנהל את השיחה בהקלדה.</span>
        </p>
      )}

      {skeleton ? (
        <ul className="persona-grid" aria-busy="true" aria-label="טוענים את הדמויות">
          {PERSONAS.map((p) => (
            <li key={p.id} className="persona-card skeleton" />
          ))}
        </ul>
      ) : (
        <ul className={`persona-grid${canCall ? '' : ' locked'}`}>
          {PERSONAS.map((p) => (
            <li key={p.id} className="persona-card" style={personaStyle(p.color)}>
              <span className="persona-avatar" aria-hidden="true">
                <PersonaPortrait persona={p} />
              </span>
              <div className="persona-info">
                <h3>
                  <span dir="ltr">{p.name}</span> <span className="persona-role">· {p.roleHe}</span>
                </h3>
                <p>{p.descriptionHe}</p>
              </div>
              <button
                type="button"
                className="btn primary small persona-call"
                onClick={() => onCall(p)}
                disabled={!canCall}
                aria-label={`התקשרו ל${p.name}, ${p.roleHe}`}
              >
                {canCall ? 'התקשרו 📞' : '🔒 התקשרו'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
