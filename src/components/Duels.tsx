import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { User } from '../../shared/api';
import {
  DUEL_DAYS,
  DUEL_PRIZES,
  MAX_OPEN_DUELS,
  duelLink,
  duelOpen,
  type DuelResult,
  type DuelSide,
  type DuelSummary,
} from '../../shared/duels';
import { INVITE_CODE_LENGTH } from '../../shared/groups';
import { api, errorMessage } from '../lib/api';
import { authRedirectUrl } from '../lib/config';
import { timeLeftText, type DuelsState } from '../lib/duels';
import { MemberPet } from './MyGroups';

interface Props {
  user: User | null;
  state: DuelsState;
  onSignIn: () => void;
  /** A finished duel's prize was collected; may return what the learner's pet got, shown on the card. */
  onPrize: (result: DuelResult, gems: number) => string | null | void;
  /** An invite code from a shared link, filled into the form. */
  duelCode: string | null;
  onDuelCodeUsed: () => void;
}

const RESULT_TEXT: Record<DuelResult, string> = {
  won: '🏆 ניצחתם!',
  lost: 'הפעם לא הלך. בפעם הבאה! 💪',
  tie: '🤝 תיקו!',
};

/** Head-to-head duels: a week-long XP race between two friends. */
export function Duels({ user, state, onSignIn, onPrize, duelCode, onDuelCodeUsed }: Props) {
  if (!user) {
    return (
      <div className="duels">
        <h2>⚔️ ראש בראש</h2>
        <div className="panel center">
          {duelCode && <p>הוזמנתם לתחרות (קוד {duelCode}).</p>}
          <p>צרו פרופיל כדי להתחרות בחברים: מי יצבור יותר XP בשבוע?</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            יצירת פרופיל
          </button>
        </div>
      </div>
    );
  }

  const open = (state.duels ?? []).filter((d) => duelOpen(d)).length;

  return (
    <div className="duels">
      <h2>⚔️ ראש בראש</h2>
      <p className="muted">
        תחרות של {DUEL_DAYS} ימים בין שני חברים: מי שצובר יותר XP מנצח. למנצח {DUEL_PRIZES.won} 💎 ומדליית ניצחון לחיה,
        בתיקו {DUEL_PRIZES.tie} 💎, ועל ההשתתפות {DUEL_PRIZES.lost} 💎.
      </p>

      <DuelNotices state={state} />

      {state.duels === null && !state.error && (
        <ol className="board" aria-busy="true" aria-label="טוען תחרויות">
          <li className="board-row skeleton" />
        </ol>
      )}

      {state.error && state.duels === null && (
        <div className="panel center">
          <p>📡 {state.error}</p>
          <button type="button" className="btn ghost" onClick={() => void state.refresh()}>
            נסו שוב
          </button>
        </div>
      )}

      {state.duels?.map((d) =>
        d.state === 'waiting' ? (
          <WaitingDuel key={d.id} duel={d} onCancelled={() => void state.refresh()} />
        ) : (
          <DuelCard
            key={d.id}
            duel={d}
            claimed={state.claimed.includes(d.id)}
            onClaim={() => {
              const prize = state.claim(d.id);
              return prize ? onPrize(prize.result, prize.gems) || null : null;
            }}
          />
        ),
      )}

      {state.duels && state.duels.length === 0 && (
        <div className="panel center">
          <p>עוד אין לכם תחרויות. פתחו אחת ושלחו את הקוד לחבר, או הצטרפו עם קוד שקיבלתם.</p>
        </div>
      )}

      {state.duels && (
        <DuelForms
          full={open >= MAX_OPEN_DUELS}
          duelCode={duelCode}
          onDone={() => {
            onDuelCodeUsed();
            void state.refresh();
          }}
        />
      )}
    </div>
  );
}

function DuelForms({ full, duelCode, onDone }: { full: boolean; duelCode: string | null; onDone: () => void }) {
  const [code, setCode] = useState(duelCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (duelCode) setCode(duelCode);
  }, [duelCode]);

  function run(e: FormEvent | null, call: () => Promise<unknown>) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    call().then(
      () => {
        setBusy(false);
        setCode('');
        onDone();
      },
      (err) => {
        setBusy(false);
        setError(errorMessage(err));
      },
    );
  }

  return (
    <div className="group-forms">
      <form className="panel" onSubmit={(e) => run(e, () => api.joinDuel(code))}>
        <h3>🔑 קיבלתם קוד?</h3>
        <label htmlFor="duel-code">קוד התחרות</label>
        <div className="inline-form">
          <input
            id="duel-code"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={INVITE_CODE_LENGTH + 4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
          />
          <button type="submit" className="btn primary" disabled={busy || code.trim().length === 0}>
            מתחילים!
          </button>
        </div>
      </form>
      <div className="panel">
        <h3>✨ תחרות חדשה</h3>
        {full ? (
          <p className="muted">אפשר לנהל עד {MAX_OPEN_DUELS} תחרויות בבת אחת.</p>
        ) : (
          <button type="button" className="btn primary" disabled={busy} onClick={() => run(null, api.createDuel)}>
            ⚔️ אתגרו חבר או חברה
          </button>
        )}
      </div>
      <p className="form-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function WaitingDuel({ duel, onCancelled }: { duel: DuelSummary; onCancelled: () => void }) {
  const [note, setNote] = useState('');
  const link = duelLink(authRedirectUrl(), duel.inviteCode);

  async function share() {
    const text = `מתחרים איתי באנגלית? מי שיצבור יותר XP ב־${DUEL_DAYS} הימים הקרובים ב־Baktana English מנצח! קוד: ${duel.inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Baktana English', text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setNote('הקישור הועתק – שלחו אותו לחבר או לחברה');
    } catch {
      // The learner closed the share sheet, or the clipboard is blocked: the code is on screen anyway.
    }
  }

  return (
    <section className="panel duel-card waiting">
      <h3>⏳ מחכים ליריב/ה</h3>
      <p>שלחו את הקוד לחבר או לחברה. התחרות מתחילה ברגע שהם מצטרפים.</p>
      <p className="invite-code" dir="ltr">
        {duel.inviteCode}
      </p>
      <div className="inline-form">
        <button type="button" className="btn primary" onClick={() => void share()}>
          שליחת הזמנה
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => api.cancelDuel(duel.id).then(onCancelled, (err) => setNote(errorMessage(err)))}
        >
          ביטול
        </button>
      </div>
      <p className="muted" role="status">
        {note || `ההזמנה בתוקף עוד ${timeLeftText(duel.endsAt)}`}
      </p>
    </section>
  );
}

function Side({ side, label }: { side: DuelSide; label: string }) {
  return (
    <div className="duel-side">
      {side.pet ? (
        <MemberPet pet={side.pet} />
      ) : (
        <span className="board-avatar" aria-hidden="true">
          {side.displayName.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      <strong dir="auto">{side.displayName}</strong>
      <span className="muted">{label}</span>
      <span className="duel-xp" dir="ltr">
        {side.xp} XP
      </span>
    </div>
  );
}

export function DuelCard({
  duel,
  claimed,
  onClaim,
}: {
  duel: DuelSummary;
  claimed: boolean;
  onClaim: () => string | null;
}) {
  const [note, setNote] = useState<string | null>(null);
  const opponent = duel.opponent ?? { displayName: '?', xp: 0 };
  const total = duel.me.xp + opponent.xp;
  const share = total === 0 ? 50 : Math.round((duel.me.xp / total) * 100);
  const lead = duel.me.xp - opponent.xp;

  return (
    <section className={`panel duel-card ${duel.state}${duel.result ? ` ${duel.result}` : ''}`}>
      <div className="duel-vs">
        <Side side={duel.me} label="אני" />
        <span className="duel-vs-mark" aria-hidden="true">
          ⚔️
        </span>
        <Side side={opponent} label="יריב/ה" />
      </div>
      <div
        className="duel-bar"
        role="img"
        aria-label={`${duel.me.xp} XP מול ${opponent.xp} XP`}
        style={{ '--share': `${share}%` } as CSSProperties}
      />
      {duel.state === 'active' ? (
        <p className="muted center">
          {lead > 0 ? `אתם מובילים ב־${lead} XP` : lead < 0 ? `חסרים לכם ${-lead} XP כדי להוביל` : 'שוויון!'} · נותרו{' '}
          {timeLeftText(duel.endsAt)}
        </p>
      ) : (
        duel.result && (
          <div className="duel-result">
            <strong>{RESULT_TEXT[duel.result]}</strong>
            {!claimed ? (
              <button type="button" className="btn primary claim-btn" onClick={() => setNote(onClaim())}>
                קבלת {DUEL_PRIZES[duel.result]} 💎
              </button>
            ) : (
              <span className="claimed">✓ נאסף</span>
            )}
          </div>
        )
      )}
      {note && (
        <p className="group-pet-prize pop" role="status">
          {note}
        </p>
      )}
    </section>
  );
}

/** "A friend accepted your invite" notices; seeing them here marks them read. */
function DuelNotices({ state }: { state: DuelsState }) {
  const { markRead, notices } = state;
  // Notices newer than this are highlighted while the view is open, also those that arrive meanwhile.
  const [seenUntil] = useState(state.readAt);
  const newest = notices[0]?.id;
  useEffect(() => markRead(), [markRead, newest]);
  if (notices.length === 0) return null;
  return (
    <section className="panel notices" aria-label="התראות תחרויות">
      <h3>🔔 התראות</h3>
      <ul>
        {notices.slice(0, 5).map((n) => (
          <li key={n.id} className={n.at > seenUntil ? 'unread' : ''}>
            <span aria-hidden="true">{n.icon}</span> {n.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
