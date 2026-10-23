import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { GroupMember, GroupSummary, User } from '../../shared/api';
import {
  GROUP_NAME_MAX,
  INVITE_CODE_LENGTH,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  inviteLink,
  type ChallengeStatus,
  type Period,
} from '../../shared/groups';
import { api, errorMessage } from '../lib/api';
import { authRedirectUrl } from '../lib/config';
import { claimKey, claimable, endsInText, type GroupsState } from '../lib/groups';
import { MEDALS } from './Leaderboard';
import { PeriodPicker } from './PeriodPicker';
import { STAGES } from '../lib/pet';
import type { PetBadge } from '../../shared/pet-design';

interface Props {
  user: User | null;
  state: GroupsState;
  onSignIn: () => void;
  /**
   * Gems collected from a completed challenge. May return what the learner's pet got from the shared
   * prize, shown under the challenges.
   */
  onGems: (gems: number) => string | null | void;
  /** An invite code from a shared link, filled into the join form. */
  joinCode: string | null;
  onJoinCodeUsed: () => void;
}

/** The learner's groups: notices, creating and joining, and each group's page. */
export function MyGroups({ user, state, onSignIn, onGems, joinCode, onJoinCodeUsed }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { markRead } = state;
  // Notices newer than this are highlighted while the tab is open; seeing them here marks them read,
  // also those that arrive while it is open.
  const [seenUntil] = useState(state.local.readAt);
  const newest = state.local.notices[0]?.id;
  useEffect(() => markRead(), [markRead, newest]);

  if (!user) {
    return (
      <div className="my-groups">
        <h2>👥 הקבוצות שלי</h2>
        <div className="panel center">
          {joinCode && <p>הוזמנתם להצטרף לקבוצה (קוד {joinCode}).</p>}
          <p>צרו פרופיל כדי ליצור קבוצה פרטית עם חברים, להתחרות יחד ולהשלים אתגרים קבוצתיים.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>
            יצירת פרופיל
          </button>
        </div>
      </div>
    );
  }

  const open = openId ? state.groups?.find((g) => g.id === openId) : undefined;
  if (open) {
    return (
      <GroupPage
        group={open}
        state={state}
        onBack={() => setOpenId(null)}
        onGems={onGems}
        onLeft={() => {
          setOpenId(null);
          void state.refresh();
        }}
      />
    );
  }

  return (
    <div className="my-groups">
      <h2>👥 הקבוצות שלי</h2>
      <p className="muted">לומדים כל אחד במסלול שלו, וכל XP שצברתם מקדם גם את הקבוצה.</p>

      {state.local.notices.length > 0 && (
        <section className="panel notices" aria-label="התראות קבוצה">
          <h3>🔔 התראות</h3>
          <ul>
            {state.local.notices.slice(0, 8).map((n) => (
              <li key={n.id} className={n.at > seenUntil ? 'unread' : ''}>
                <span aria-hidden="true">{n.icon}</span> {n.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.groups === null && !state.error && (
        <ol className="board" aria-busy="true" aria-label="טוען קבוצות">
          <li className="board-row skeleton" />
        </ol>
      )}

      {state.error && state.groups === null && (
        <div className="panel center">
          <p>📡 {state.error}</p>
          <button type="button" className="btn ghost" onClick={() => void state.refresh()}>
            נסו שוב
          </button>
        </div>
      )}

      {state.groups?.map((g) => (
        <button key={g.id} type="button" className="group-card" onClick={() => setOpenId(g.id)}>
          <span className="group-card-head">
            <strong dir="auto">{g.name}</strong>
            {claimable(state.local, g).length > 0 && <span className="claim-dot">💎 פרס מחכה</span>}
          </span>
          <span className="muted">
            {g.memberCount === 1 ? 'רק את/ה, בינתיים' : `${g.memberCount} חברים`} · {g.weekXp} XP השבוע
            {g.weekRank !== null && ` · מקום ${g.weekRank} בדירוג`}
          </span>
          <span className="mini-challenges" aria-label="התקדמות באתגרי השבוע">
            {g.challenges.map((c) => (
              <span key={c.id} className={`mini-bar${c.done ? ' done' : ''}`} title={c.title}>
                <span style={{ width: `${Math.round((c.progress / c.goal) * 100)}%` }} />
              </span>
            ))}
          </span>
        </button>
      ))}

      {state.groups && state.groups.length === 0 && (
        <div className="panel center">
          <p>עוד אין לכם קבוצה. צרו אחת והזמינו חברים, או הצטרפו עם קוד שקיבלתם.</p>
        </div>
      )}

      {state.groups && (
        <GroupForms
          full={state.groups.length >= MAX_GROUPS_PER_USER}
          joinCode={joinCode}
          onDone={(group) => {
            onJoinCodeUsed();
            void state.refresh().then(() => setOpenId(group.id));
          }}
        />
      )}
    </div>
  );
}

function GroupForms({
  full,
  joinCode,
  onDone,
}: {
  full: boolean;
  joinCode: string | null;
  onDone: (group: GroupSummary) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(joinCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (joinCode) setCode(joinCode);
  }, [joinCode]);

  function run(e: FormEvent, call: () => Promise<{ group: GroupSummary }>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    call().then(
      (res) => {
        setBusy(false);
        setName('');
        setCode('');
        onDone(res.group);
      },
      (err) => {
        setBusy(false);
        setError(errorMessage(err));
      },
    );
  }

  if (full) {
    return <p className="muted center">אפשר להיות בעד {MAX_GROUPS_PER_USER} קבוצות בבת אחת.</p>;
  }

  return (
    <div className="group-forms">
      <form className="panel" onSubmit={(e) => run(e, () => api.joinGroup(code))}>
        <h3>🔑 הצטרפות לקבוצה</h3>
        <label htmlFor="join-code">קוד הצטרפות</label>
        <div className="inline-form">
          <input
            id="join-code"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={INVITE_CODE_LENGTH + 4}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC123"
          />
          <button type="submit" className="btn primary" disabled={busy || code.trim().length === 0}>
            הצטרפות
          </button>
        </div>
      </form>
      <form className="panel" onSubmit={(e) => run(e, () => api.createGroup(name))}>
        <h3>✨ קבוצה חדשה</h3>
        <label htmlFor="group-name">שם הקבוצה</label>
        <div className="inline-form">
          <input
            id="group-name"
            dir="auto"
            maxLength={GROUP_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: המשפחה, כיתה ח׳2"
          />
          <button type="submit" className="btn primary" disabled={busy || name.trim().length === 0}>
            יצירה
          </button>
        </div>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>
    </div>
  );
}

function GroupPage({
  group,
  state,
  onBack,
  onGems,
  onLeft,
}: {
  group: GroupSummary;
  state: GroupsState;
  onBack: () => void;
  onGems: Props['onGems'];
  onLeft: () => void;
}) {
  const [period, setPeriod] = useState<Period>('week');
  const [prize, setPrize] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    let live = true;
    setMembers(null);
    api.groupMembers(group.id, period).then(
      (res) => live && setMembers(res.members),
      (err) => live && setError(errorMessage(err)),
    );
    return () => {
      live = false;
    };
  }, [group.id, period]);

  const link = inviteLink(authRedirectUrl(), group.inviteCode);

  async function share() {
    const text = `בואו ללמוד אנגלית איתי בקבוצה „${group.name}” ב־Baktana English! קוד ההצטרפות: ${group.inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Baktana English', text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied('הקישור הועתק – שלחו אותו לחברים');
    } catch {
      // The learner closed the share sheet, or the clipboard is blocked: the code is on screen anyway.
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopied('הקוד הועתק');
    } catch {
      setCopied('');
    }
  }

  function leave() {
    api.leaveGroup(group.id).then(onLeft, (err) => setError(errorMessage(err)));
  }

  return (
    <div className="group-page">
      <button type="button" className="link-btn" onClick={onBack}>
        › חזרה לקבוצות שלי
      </button>
      <h2 dir="auto">👥 {group.name}</h2>
      <p className="muted">
        {group.memberCount} / {MAX_GROUP_MEMBERS} חברים · {group.weekScore} XP לחבר/ה השבוע
        {group.weekRank !== null && ` · מקום ${group.weekRank} בדירוג הקבוצות`}
      </p>

      <section className="panel invite">
        <h3>📨 הזמנת חברים</h3>
        <p>שלחו לחברים את הקישור, או תנו להם את הקוד:</p>
        <p className="invite-code" dir="ltr">
          {group.inviteCode}
        </p>
        <div className="inline-form">
          <button type="button" className="btn primary" onClick={() => void share()}>
            שיתוף קישור
          </button>
          <button type="button" className="btn ghost" onClick={() => void copyCode()}>
            העתקת הקוד
          </button>
        </div>
        <p className="muted" role="status">
          {copied}
        </p>
      </section>

      <section className="panel challenges">
        <h3>🎯 אתגרי השבוע</h3>
        <p className="muted">{endsInText(group.weekEnd)} · היעדים גדלים עם מספר החברים</p>
        {prize && (
          <p className="group-pet-prize pop" role="status">
            {prize}
          </p>
        )}
        <ul>
          {group.challenges.map((c) => (
            <ChallengeRow
              key={c.id}
              challenge={c}
              claimed={state.local.claimed.includes(claimKey(group.id, c.id))}
              onClaim={() => {
                const gems = state.claim(group.id, c.id);
                if (gems > 0) setPrize(onGems(gems) || null);
              }}
            />
          ))}
        </ul>
      </section>

      <section className="group-members">
        <h3>🏅 הדירוג בקבוצה</h3>
        <PeriodPicker value={period} onChange={setPeriod} label="תקופת הדירוג בקבוצה" />
        {members === null && !error && (
          <ol className="board" aria-busy="true" aria-label="טוען חברים">
            <li className="board-row skeleton" />
          </ol>
        )}
        {members && (
          <ol className="board">
            {members.map((m) => (
              <li key={`${m.rank}-${m.displayName}`} className={`board-row${m.isMe ? ' me' : ''}`}>
                <span className="board-rank">{MEDALS[m.rank - 1] ?? m.rank}</span>
                {m.pet ? (
                  <MemberPet pet={m.pet} />
                ) : (
                  <span className="board-avatar" aria-hidden="true">
                    {m.displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
                <span className="board-name" dir="auto">
                  {m.displayName}
                  {m.isMe && <span className="me-tag"> (אני)</span>}
                  {m.isOwner && <span className="board-sub">מייסד/ת הקבוצה</span>}
                  {m.pet && (
                    <span className="board-sub">
                      🐾 {m.pet.name} · {STAGES[m.pet.stage]?.name}
                    </span>
                  )}
                </span>
                <span className="board-xp" dir="ltr">
                  {m.xp} XP
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="form-error" role="alert">
        {error}
      </p>

      <div className="leave-group">
        {confirmLeave ? (
          <>
            <p>לעזוב את „{group.name}”? אפשר לחזור בכל זמן עם הקוד, אבל ה־XP ייספר לקבוצה רק מההצטרפות החדשה.</p>
            <div className="inline-form">
              <button type="button" className="btn danger" onClick={leave}>
                כן, לעזוב
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmLeave(false)}>
                ביטול
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="link-btn" onClick={() => setConfirmLeave(true)}>
            עזיבת הקבוצה
          </button>
        )}
      </div>
    </div>
  );
}

function ChallengeRow({
  challenge: c,
  claimed,
  onClaim,
}: {
  challenge: ChallengeStatus;
  claimed: boolean;
  onClaim: () => void;
}) {
  const percent = Math.round((c.progress / c.goal) * 100);
  return (
    <li className={`challenge${c.done ? ' done' : ''}`}>
      <span className="challenge-icon" aria-hidden="true">
        {c.icon}
      </span>
      <span className="challenge-body">
        <span className="challenge-title">{c.title}</span>
        <span
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={c.goal}
          aria-valuenow={c.progress}
          aria-label={c.title}
        >
          <span className="progress-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="muted" dir="ltr">
          {c.progress} / {c.goal}
        </span>
      </span>
      {c.done && !claimed && (
        <button type="button" className="btn primary claim-btn" onClick={onClaim}>
          קבלת {c.gems} 💎
        </button>
      )}
      {c.done && claimed && <span className="claimed">✓ נאסף</span>}
      {!c.done && (
        <span className="challenge-gems muted" aria-label={`פרס: ${c.gems} יהלומים`}>
          {c.gems} 💎
        </span>
      )}
    </li>
  );
}

/** A member's shared pet in the group board, in place of their initial. */
export function MemberPet({ pet }: { pet: PetBadge }) {
  const style = { '--pet-color': pet.color } as CSSProperties;
  return (
    <span className="board-avatar member-pet" style={style} role="img" aria-label={`החיה ${pet.name}`}>
      <span aria-hidden="true">{pet.emoji}</span>
      {pet.worn.length > 0 && (
        <span className="member-pet-worn" aria-hidden="true">
          {pet.worn.join('')}
        </span>
      )}
    </span>
  );
}
