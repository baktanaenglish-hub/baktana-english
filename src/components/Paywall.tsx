import { useEffect, useRef, useState } from 'react';
import type { User } from '../../shared/api';
import { CALL_LIMITS, type CallStatusResponse } from '../../shared/call';
import {
  BillingError,
  BILLING_ERROR_MESSAGE,
  billingSupport,
  loadPlans,
  MANAGE_SUBSCRIPTION_URL,
  purchasePlan,
  restorePurchases,
  subscriptionText,
  trialText,
  type BillingSupport,
  type Plan,
} from '../lib/billing';
import { getCallStatus } from '../lib/call-api';
import { PRIVACY_URL, TERMS_URL } from '../lib/config';
import { PremiumBadge } from './TopBar';

interface Props {
  user: User | null;
  /** The last known premium status (from call-turn). */
  status: CallStatusResponse | null;
  onStatus: (status: CallStatusResponse) => void;
  onSignIn: () => void;
  onClose: () => void;
  /** Opens the call tab once premium is active. */
  onCalls: () => void;
}

type Plans = { kind: 'loading' } | { kind: 'ready'; plans: Plan[] } | { kind: 'error'; message: string };
type Phase = 'idle' | 'buying' | 'restoring' | 'activating' | 'active' | 'slow' | 'pending';

/** After a purchase the webhook updates the server within seconds; check this often, this many times. */
const POLL_MS = 2000;
const POLL_TRIES = 15;

const BENEFITS = [
  { icon: '📞', text: `עד ${CALL_LIMITS.callsPerDay} שיחות וידאו ביום עם דמויות AI שמדברות איתכם באנגלית` },
  { icon: '✍️', text: 'תיקונים והסברים בעברית תוך כדי השיחה' },
  { icon: '🎭', text: 'דמויות ומצבים שונים – מתרגלים אנגלית של החיים האמיתיים' },
  { icon: '👑', text: 'תג פרימיום בפרופיל' },
];

/** The premium screen: what it includes, the plans from Google Play, buying and restoring. */
export function Paywall({ user, status, onStatus, onSignIn, onClose, onCalls }: Props) {
  const [support, setSupport] = useState<BillingSupport | null>(null);
  const [plans, setPlans] = useState<Plans>({ kind: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void billingSupport().then((s) => alive.current && setSupport(s));
    return () => {
      alive.current = false;
    };
  }, []);

  const userId = user?.id ?? null;
  const premium = status?.premium === true;
  /** The learner whose premium status the server has just answered (or couldn't be reached for). */
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  // The screen can open before the app heard from the server (from the profile right after launch),
  // so it asks again: a premium learner sees their membership, never the plans.
  const canBuy = support === 'store' && userId !== null && checkedFor === userId && !premium;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const done = () => !controller.signal.aborted && setCheckedFor(userId);
    getCallStatus(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      onStatus(res);
      done();
    }, done);
    return () => controller.abort();
    // Only a new learner asks again; onStatus is App's state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function fetchPlans(id: string) {
    setPlans({ kind: 'loading' });
    loadPlans(id).then(
      (list) => {
        if (!alive.current) return;
        setPlans({ kind: 'ready', plans: list });
        setSelected((s) => s ?? list[0]?.id ?? null);
      },
      (err) => alive.current && setPlans({ kind: 'error', message: messageOf(err) }),
    );
  }

  useEffect(() => {
    if (canBuy && userId) fetchPlans(userId);
    // Only a new learner or a change in what can be bought loads the plans again.
  }, [canBuy, userId]);

  /** Asks the server until the webhook has made the learner premium. */
  async function activate() {
    setPhase('activating');
    for (let i = 0; i < POLL_TRIES && alive.current; i++) {
      try {
        const res = await getCallStatus();
        if (res.premium) {
          if (!alive.current) return;
          onStatus(res);
          setPhase('active');
          return;
        }
      } catch {
        // Offline for a moment – keep trying.
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (alive.current) setPhase('slow');
  }

  async function buy() {
    if (!userId || !selected) return;
    setError(null);
    setPhase('buying');
    try {
      const result = await purchasePlan(userId, selected);
      if (!alive.current) return;
      if (result === 'purchased') await activate();
      else setPhase(result === 'pending' ? 'pending' : 'idle');
    } catch (err) {
      if (!alive.current) return;
      setError(messageOf(err));
      setPhase('idle');
    }
  }

  async function restore() {
    if (!userId) return;
    setError(null);
    setPhase('restoring');
    try {
      const active = await restorePurchases(userId);
      if (!alive.current) return;
      if (active) await activate();
      else {
        setError('לא מצאנו מנוי פעיל בחשבון Google שבטלפון הזה.');
        setPhase('idle');
      }
    } catch (err) {
      if (!alive.current) return;
      setError(messageOf(err));
      setPhase('idle');
    }
  }

  const plan = plans.kind === 'ready' ? plans.plans.find((p) => p.id === selected) : undefined;
  const busy = phase === 'buying' || phase === 'restoring' || phase === 'activating';

  return (
    <div className="paywall">
      <header className="auth-header">
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="חזרה"
          disabled={phase === 'buying' || phase === 'restoring'}
        >
          ✕
        </button>
      </header>
      <div className="paywall-body">
        <div className="paywall-hero" aria-hidden="true">
          👑
        </div>
        <h1>
          <bdi dir="ltr">Baktana English</bdi> פרימיום
        </h1>
        <p className="lead">מדברים אנגלית באמת – עם דמויות AI, בכל שעה, בלי מבוכה.</p>

        <ul className="paywall-benefits">
          {BENEFITS.map((b) => (
            <li key={b.icon}>
              <span aria-hidden="true">{b.icon}</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>

        {phase === 'active' || (premium && phase !== 'activating') ? (
          <div className="panel center paywall-done" role="status">
            {phase === 'active' && <p className="call-gate-title">🎉 ברוכים הבאים לפרימיום!</p>}
            {phase !== 'active' && <PremiumBadge />}
            {phase !== 'active' && <p>המנוי שלכם פעיל.</p>}
            {subscriptionText(status) && <p className="muted">{subscriptionText(status)}</p>}
            <button type="button" className="btn primary wide" onClick={onCalls}>
              לשיחות 📞
            </button>
            {status?.premiumUntil && support === 'store' && (
              <a className="link-btn" href={MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noreferrer">
                ניהול המנוי ב־Google Play
              </a>
            )}
          </div>
        ) : phase === 'activating' ? (
          <div className="panel center" role="status" aria-live="polite">
            <p className="call-gate-title">⏳ מפעילים את המנוי…</p>
            <p className="muted">זה לוקח כמה שניות.</p>
          </div>
        ) : phase === 'slow' ? (
          <div className="panel center" role="status">
            <p className="call-gate-title">✅ הרכישה התקבלה</p>
            <p>המנוי ייפתח בעוד כמה דקות. אפשר לסגור את המסך ולחזור לשיחות מאוחר יותר.</p>
            <button type="button" className="btn ghost small" onClick={() => void activate()}>
              לבדוק שוב
            </button>
          </div>
        ) : phase === 'pending' ? (
          <div className="panel center" role="status">
            <p className="call-gate-title">⏳ התשלום ממתין לאישור</p>
            <p>Google Play יאשר את התשלום בקרוב, והמנוי ייפתח מיד אחר כך.</p>
          </div>
        ) : !user ? (
          <div className="panel center call-gate">
            <p>כדי להצטרף לפרימיום צריך קודם להתחבר, כדי שהמנוי יישמר בחשבון שלכם.</p>
            <button type="button" className="btn primary" onClick={onSignIn}>
              התחברות
            </button>
          </div>
        ) : support === null ? null : support === 'elsewhere' ? (
          <div className="panel center call-gate">
            <p>
              ההצטרפות לפרימיום נעשית באפליקציה <bdi dir="ltr">Baktana English</bdi> מ־Google Play. אחרי ההצטרפות,
              מתחברים לאותו חשבון ונהנים מפרימיום גם כאן.
            </p>
          </div>
        ) : support === 'unconfigured' ? (
          <div className="panel center call-gate">
            <p className="call-gate-title">🚀 המנוי ייפתח בקרוב!</p>
            <p className="muted">אנחנו מסיימים להכין את הכול. נעדכן כאן כשאפשר יהיה להצטרף.</p>
          </div>
        ) : plans.kind === 'loading' ? (
          <div className="paywall-plans" aria-busy="true" aria-label="טוענים את המחירים">
            <div className="paywall-plan skeleton" />
            <div className="paywall-plan skeleton" />
          </div>
        ) : plans.kind === 'error' ? (
          <div className="panel center" role="alert">
            <p>📡 {plans.message}</p>
            <button type="button" className="btn ghost small" onClick={() => userId && fetchPlans(userId)}>
              נסו שוב
            </button>
          </div>
        ) : (
          <>
            <div className="paywall-plans" role="radiogroup" aria-label="בחירת מסלול">
              {plans.plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === selected}
                  className={`paywall-plan${p.id === selected ? ' selected' : ''}`}
                  onClick={() => setSelected(p.id)}
                  disabled={busy}
                >
                  {p.savePercent !== undefined && <span className="paywall-save">חיסכון של {p.savePercent}%</span>}
                  <span className="paywall-plan-name">{p.period === 'year' ? 'שנתי' : 'חודשי'}</span>
                  <span className="paywall-price">
                    <bdi>{p.price}</bdi> {p.period === 'year' ? 'לשנה' : 'לחודש'}
                  </span>
                  {p.perMonth && (
                    <span className="muted">
                      (<bdi>{p.perMonth}</bdi> לחודש)
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button type="button" className="btn secondary wide" onClick={() => void buy()} disabled={busy || !plan}>
              {phase === 'buying'
                ? 'פותחים את Google Play…'
                : plan?.trialDays
                  ? `מתחילים ${trialText(plan.trialDays)}`
                  : 'הצטרפות לפרימיום'}
            </button>
            {plan && (
              <p className="paywall-fine">
                {plan.trialDays > 0 &&
                  `${trialText(plan.trialDays)}, ואחר כך ${plan.price} ${plan.period === 'year' ? 'לשנה' : 'לחודש'}. `}
                המנוי מתחדש אוטומטית {plan.period === 'year' ? 'בכל שנה' : 'בכל חודש'} ונגבה דרך חשבון Google Play שלכם,
                עד שמבטלים. אפשר לבטל בכל רגע ב־Google Play, והגישה נשארת עד סוף התקופה ששולמה.
                {plan.trialDays > 0 && ' ביטול לפני סוף תקופת הניסיון – בלי חיוב.'}
              </p>
            )}
            <p className="paywall-fine">מתחת לגיל 18? בקשו מהורה לאשר את הרכישה.</p>
          </>
        )}

        <div className="form-error" role="alert" aria-live="polite">
          {error}
        </div>

        {canBuy && phase === 'idle' && (
          <div className="paywall-links">
            <button type="button" className="link-btn" onClick={() => void restore()} disabled={busy}>
              שחזור רכישה
            </button>
            <a className="link-btn" href={MANAGE_SUBSCRIPTION_URL} target="_blank" rel="noreferrer">
              ניהול המנוי ב־Google Play
            </a>
          </div>
        )}
        {phase === 'restoring' && <p className="paywall-fine">בודקים רכישות קודמות…</p>}

        <p className="legal-links">
          <a href={TERMS_URL} target="_blank" rel="noreferrer">
            תנאי שימוש
          </a>
          {' · '}
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
            מדיניות פרטיות
          </a>
        </p>
      </div>
    </div>
  );
}

/** BillingErrors carry a Hebrew message; anything else gets the general one. */
function messageOf(err: unknown): string {
  return err instanceof BillingError && err.message ? err.message : BILLING_ERROR_MESSAGE;
}
