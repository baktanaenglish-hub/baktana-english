import type { UpdateState } from '../lib/update';

interface Props {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
}

/** Offers a newer version of the Android app on launch. */
export function UpdatePrompt({ state, onInstall, onDismiss }: Props) {
  if (state.status === 'idle') return null;
  const downloading = state.status === 'downloading';

  return (
    <div className="update-overlay">
      <div className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <div className="big-emoji" aria-hidden="true">
          🚀
        </div>
        <h2 id="update-title">יש גרסה חדשה!</h2>
        <p className="muted">גרסה {state.version.versionName} מוכנה להתקנה. ההתקדמות שלכם נשמרת.</p>
        {downloading && (
          <div
            className="update-progress"
            role="progressbar"
            aria-valuenow={state.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${state.percent}%` }} />
          </div>
        )}
        {state.status === 'failed' && <p className="update-error">ההורדה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.</p>}
        <button type="button" className="btn primary wide" onClick={onInstall} disabled={downloading} autoFocus>
          {downloading ? `מוריד… ${state.percent}%` : state.status === 'failed' ? 'נסו שוב' : 'עדכון עכשיו'}
        </button>
        {!downloading && (
          <button type="button" className="btn ghost wide" onClick={onDismiss}>
            לא עכשיו
          </button>
        )}
      </div>
    </div>
  );
}
