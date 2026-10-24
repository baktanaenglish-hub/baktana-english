import { useState, type FormEvent } from 'react';
import type { User } from '../../shared/api';
import { allLessons } from '../data/course';
import type { SyncStatus } from '../lib/account';
import { errorMessage } from '../lib/api';
import { PRIVACY_URL, TERMS_URL } from '../lib/config';
import { GOAL_OPTIONS, dailyGoalOf } from '../lib/goals';
import { canListen } from '../lib/listen';
import { MAX_HEARTS, msUntilNextHeart, type Progress } from '../lib/progress';
import type { Settings, ThemeChoice } from '../lib/settings';
import { ReminderSettings } from './ReminderSettings';
import { PremiumBadge, avatarFace } from './TopBar';

interface Props {
  progress: Progress;
  streak: number;
  user: User | null;
  /** The signed-in learner is a premium member. */
  premium?: boolean;
  /** "מתחדש ב־…" / "בתוקף עד …" for a paid subscription; empty otherwise. */
  subscription?: string;
  /** Opens the premium screen; omitted when this build has no calls. */
  onPremium?: () => void;
  syncStatus: SyncStatus;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  onGoal: (xp: number) => void;
  /** Omitted when accounts are disabled (static deploy). */
  onSignIn?: () => void;
  onSignOut: () => void;
  /** Deletes the account after the password is entered again; rejects with a Hebrew message. */
  onDeleteAccount: (password: string) => Promise<void>;
  onSync: () => void;
  onReset: () => void;
  /** The avatar bought with gems, if one was chosen. */
  avatar?: string | null;
  gems?: number;
  /** Opens the gem shop. */
  onShop?: () => void;
}

const SYNC_TEXT: Record<SyncStatus, string> = {
  guest: '',
  syncing: '🔄 מסנכרן…',
  synced: '✅ ההתקדמות מסונכרנת',
  offline: '📡 אין חיבור – ההתקדמות נשמרת במכשיר ותסונכרן אחר כך',
};

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'אוטומטי' },
  { value: 'light', label: '☀️ בהיר' },
  { value: 'dark', label: '🌙 כהה' },
];

export function Profile(props: Props) {
  const { progress, streak, user, syncStatus, settings } = props;
  const done = allLessons.filter((l) => progress.completed[l.id]).length;
  const goalXp = dailyGoalOf(progress);
  const goal = Math.min(100, (progress.xpToday / goalXp) * 100);
  const nextHeart = Math.ceil(msUntilNextHeart(progress) / 60000);

  return (
    <div className="profile">
      <section className="account-card">
        <div className={`avatar${props.avatar ? ' bought' : ''}`} aria-hidden="true">
          {avatarFace(user?.displayName ?? null, props.avatar)}
        </div>
        <div className="account-info">
          <h2 dir="auto">{user ? user.displayName : 'אורח/ת'}</h2>
          {user && props.premium && <PremiumBadge />}
          {user ? (
            <>
              <span className="muted" dir="ltr">
                {user.email}
              </span>
              <span className="sync-status" role="status">
                {SYNC_TEXT[syncStatus]}
              </span>
            </>
          ) : (
            <span className="muted">ההתקדמות נשמרת רק במכשיר הזה</span>
          )}
        </div>
      </section>
      <div className="account-actions">
        {user ? (
          <>
            {syncStatus === 'offline' && (
              <button type="button" className="btn ghost small" onClick={props.onSync}>
                סנכרון עכשיו
              </button>
            )}
            <button type="button" className="btn ghost small" onClick={props.onSignOut}>
              התנתקות
            </button>
            <DeleteAccount onDelete={props.onDeleteAccount} subscriptions={props.onPremium !== undefined} />
          </>
        ) : (
          props.onSignIn && (
            <button type="button" className="btn secondary wide" onClick={props.onSignIn}>
              יצירת פרופיל / התחברות
            </button>
          )
        )}
      </div>

      {user && props.onPremium && (
        <section className="panel premium-card">
          <div>
            <h3>{props.premium ? '👑 מנוי פרימיום' : '👑 פרימיום'}</h3>
            <p className="muted">
              {props.premium ? props.subscription || 'המנוי שלכם פעיל' : 'שיחות וידאו באנגלית עם דמויות AI'}
            </p>
          </div>
          <button
            type="button"
            className={`btn small ${props.premium ? 'ghost' : 'secondary'}`}
            onClick={props.onPremium}
          >
            {props.premium ? 'פרטי המנוי' : 'לפרטים'}
          </button>
        </section>
      )}

      <h2>ההתקדמות שלי</h2>
      <div className="stat-cards">
        <div className="stat-card streak">
          <span className="label">רצף ימים</span>
          <span className="value">🔥 {streak}</span>
        </div>
        <div className="stat-card xp">
          <span className="label">סה״כ XP</span>
          <span className="value">⭐ {progress.xp}</span>
        </div>
        {props.gems !== undefined && (
          <button type="button" className="stat-card gems" onClick={props.onShop} aria-label="יהלומים – לחנות">
            <span className="label">יהלומים</span>
            <span className="value">💎 {props.gems}</span>
          </button>
        )}
        <div className="stat-card accuracy">
          <span className="label">שיעורים</span>
          <span className="value">
            {done}/{allLessons.length}
          </span>
        </div>
      </div>

      <section className="panel">
        <h3>יעד יומי</h3>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="התקדמות ביעד היומי"
          aria-valuemin={0}
          aria-valuemax={goalXp}
          aria-valuenow={Math.min(progress.xpToday, goalXp)}
        >
          <div className="progress-fill gold" style={{ width: `${goal}%` }} />
        </div>
        <p>
          היום: {progress.xpToday} מתוך <bdi>{goalXp} XP</bdi>
        </p>
        <div className="chips" role="radiogroup" aria-label="בחירת יעד יומי">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.xp}
              type="button"
              role="radio"
              aria-checked={goalXp === option.xp}
              className={`chip${goalXp === option.xp ? ' selected' : ''}`}
              onClick={() => props.onGoal(option.xp)}
            >
              {option.label} · {option.xp}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>לבבות</h3>
        <p>
          ❤️ {progress.hearts} מתוך {MAX_HEARTS}
          {progress.hearts < MAX_HEARTS && ` · לב הבא בעוד ${nextHeart} דק׳`}
        </p>
      </section>

      <ReminderSettings settings={settings} onSettings={props.onSettings} />

      <section className="panel">
        <h3>הגדרות</h3>
        <div className="setting-row">
          <span id="theme-label">מראה</span>
          <div className="chips" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={settings.theme === theme.value}
                className={`chip${settings.theme === theme.value ? ' selected' : ''}`}
                onClick={() => props.onSettings({ theme: theme.value })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span id="sound-label">צלילים</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.sound}
            aria-labelledby="sound-label"
            className={`switch${settings.sound ? ' on' : ''}`}
            onClick={() => props.onSettings({ sound: !settings.sound })}
          >
            <span className="switch-knob" />
          </button>
        </div>
        {canListen && (
          <div className="setting-row">
            <span id="speaking-label">תרגילי דיבור (מיקרופון)</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.speaking}
              aria-labelledby="speaking-label"
              className={`switch${settings.speaking ? ' on' : ''}`}
              onClick={() => props.onSettings({ speaking: !settings.speaking })}
            >
              <span className="switch-knob" />
            </button>
          </div>
        )}
        <div className="setting-row">
          <span id="analytics-label">שליחת נתוני שימוש אנונימיים</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.analytics}
            aria-labelledby="analytics-label"
            className={`switch${settings.analytics ? ' on' : ''}`}
            onClick={() => props.onSettings({ analytics: !settings.analytics })}
          >
            <span className="switch-knob" />
          </button>
        </div>
      </section>

      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          const question = user
            ? 'לאפס את כל ההתקדמות – גם בחשבון ובכל המכשירים? אי אפשר לבטל.'
            : 'לאפס את כל ההתקדמות במכשיר הזה?';
          if (confirm(question)) props.onReset();
        }}
      >
        איפוס התקדמות
      </button>

      <p className="legal-links">
        <a href={PRIVACY_URL} target="_blank" rel="noopener">
          מדיניות פרטיות
        </a>
        {' · '}
        <a href={TERMS_URL} target="_blank" rel="noopener">
          תנאי שימוש
        </a>
      </p>
    </div>
  );
}

/** "Delete account" – required by the app stores. Asks for the password before deleting. */
function DeleteAccount({
  onDelete,
  subscriptions,
}: {
  onDelete: (password: string) => Promise<void>;
  /** Premium is on sale, so warn that deleting the account doesn't cancel a store subscription. */
  subscriptions: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError('יש להזין את הסיסמה.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDelete(password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="link-btn danger-link" onClick={() => setOpen(true)}>
        מחיקת החשבון
      </button>
    );
  }
  return (
    <form className="panel delete-account" onSubmit={submit} noValidate>
      <h3>מחיקת החשבון</h3>
      <p>
        החשבון יימחק לצמיתות, ואיתו ההתקדמות השמורה בשרת, המקום בליגה ונתוני השימוש שקשורים אליו. אי אפשר לבטל את זה.
        ההתקדמות במכשיר הזה תישאר, ואפשר לאפס אותה בנפרד.
      </p>
      {subscriptions && (
        <p>
          <strong>יש לכם מנוי פרימיום?</strong> מחיקת החשבון לא מבטלת אותו. כדי שלא תחויבו שוב, בטלו אותו קודם ב־Google
          Play ← תשלומים ומינויים.
        </p>
      )}
      <label className="field">
        <span>הסיסמה שלכם, לאישור</span>
        <input
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <div className="form-error" role="alert" aria-live="polite">
        {error}
      </div>
      <div className="account-actions">
        <button type="submit" className="btn danger small" disabled={busy}>
          {busy ? 'מוחק…' : 'מחיקה לצמיתות'}
        </button>
        <button
          type="button"
          className="btn ghost small"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setPassword('');
            setError(null);
          }}
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
