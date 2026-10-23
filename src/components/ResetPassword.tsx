import { useState, type FormEvent } from 'react';
import type { AuthResponse } from '../../shared/api';
import { ApiRequestError, api, errorMessage } from '../lib/api';
import { MIN_PASSWORD } from './AuthScreen';

interface Props {
  onDone: (res: AuthResponse) => void;
  onCancel: () => void;
  /** The link expired or was used: back to the sign-in screen to ask for a new one. */
  onNewLink: () => void;
}

/** Validates the new password; returns a Hebrew message or null. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים.`;
  if (password !== confirm) return 'הסיסמאות לא זהות.';
  return null;
}

/** Opens from the password-reset email: the learner picks a new password and is signed in. */
export function ResetPassword({ onDone, onCancel, onNewLink }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateNewPassword(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await api.setNewPassword(password));
    } catch (err) {
      setExpired(err instanceof ApiRequestError && err.code === 'reset_link_expired');
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <header className="auth-header">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="חזרה">
          ✕
        </button>
      </header>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h1>בחירת סיסמה חדשה</h1>
        <p className="lead">בחרו סיסמה חדשה לחשבון. אחרי השמירה תהיו מחוברים.</p>
        <label className="field">
          <span>סיסמה חדשה</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span>אימות הסיסמה</span>
          <input
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <div className="form-error" role="alert" aria-live="polite">
          {error}
        </div>
        {expired ? (
          <button type="button" className="btn primary wide" onClick={onNewLink}>
            בקשת קישור חדש
          </button>
        ) : (
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? 'רגע…' : 'שמירת הסיסמה'}
          </button>
        )}
      </form>
    </div>
  );
}
