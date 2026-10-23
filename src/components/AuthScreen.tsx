import { useState, type FormEvent } from 'react';
import type { AuthResponse } from '../../shared/api';
import { api, errorMessage } from '../lib/api';
import { PRIVACY_URL, TERMS_URL } from '../lib/config';

interface Props {
  /** `mode` tells a new account ('register') from a login. */
  onSignedIn: (res: AuthResponse, mode: Mode) => void;
  onCancel: () => void;
  initialMode?: Mode;
}

export type Mode = 'register' | 'login';

export const MIN_PASSWORD = 8;

/** Validates the form before sending; returns a Hebrew message or null. */
export function validateAuth(mode: Mode, email: string, password: string, displayName: string): string | null {
  if (mode === 'register' && displayName.trim().length < 2) return 'השם צריך להכיל לפחות 2 תווים.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'כתובת האימייל לא תקינה.';
  if (mode === 'login' && !password) return 'יש להזין סיסמה.';
  // Same minimum as the server (server/src/routes/auth.ts).
  if (mode === 'register' && password.length < MIN_PASSWORD) return `הסיסמה צריכה להכיל לפחות ${MIN_PASSWORD} תווים.`;
  return null;
}

/** Optional sign-in / sign-up. Guests can use the whole app without it. */
export function AuthScreen({ onSignedIn, onCancel, initialMode = 'register' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateAuth(mode, email, password, displayName);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'register'
          ? await api.register({ email: email.trim(), password, displayName: displayName.trim() })
          : await api.login({ email: email.trim(), password });
      onSignedIn(res, mode);
    } catch (err) {
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
        <h1>{mode === 'register' ? 'יצירת פרופיל' : 'התחברות'}</h1>
        <p className="lead">
          {mode === 'register'
            ? 'שמרו את ההתקדמות, למדו מכל מכשיר והתחרו בליגה השבועית.'
            : 'ברוכים השבים! ההתקדמות מהמכשיר הזה תתמזג עם החשבון.'}
        </p>
        {mode === 'register' && (
          <label className="field">
            <span>שם תצוגה</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={40}
              required
            />
          </label>
        )}
        <label className="field">
          <span>אימייל</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            required
          />
        </label>
        <label className="field">
          <span>סיסמה</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
        </label>
        <div className="form-error" role="alert" aria-live="polite">
          {error}
        </div>
        <button type="submit" className="btn primary wide" disabled={busy}>
          {busy ? 'רגע…' : mode === 'register' ? 'יצירת חשבון' : 'כניסה'}
        </button>
        {mode === 'register' && (
          <p className="legal-note">
            ביצירת חשבון את/ה מסכים/ה ל
            <a href={TERMS_URL} target="_blank" rel="noopener">
              תנאי השימוש
            </a>{' '}
            ול
            <a href={PRIVACY_URL} target="_blank" rel="noopener">
              מדיניות הפרטיות
            </a>
            .
          </p>
        )}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'register' ? 'login' : 'register');
            setError(null);
          }}
        >
          {mode === 'register' ? 'כבר יש לי חשבון – התחברות' : 'אין לי חשבון – הרשמה'}
        </button>
      </form>
    </div>
  );
}
