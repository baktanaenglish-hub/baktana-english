import { useState, type CSSProperties } from 'react';
import {
  ABILITIES,
  ACCESSORIES,
  SPECIES,
  STAGES,
  challengeGems,
  challengeStatus,
  greetingLine,
  hasAbility,
  petLook,
  shareText,
  todaysChallenge,
  xpToNextStage,
  type PetState,
} from '../../lib/pet';
import type { PetDesign } from '../../../shared/pet-design';
import { PetAvatar } from './PetAvatar';
import { PetDesigner } from './PetDesigner';

interface Props {
  pet: PetState | null;
  xp: number;
  streak: number;
  practicedToday: boolean;
  today: string;
  premium: boolean;
  /** Signed in with a backend that can design with AI. */
  canDesignWithAi: boolean;
  onAdopt: (species: string, name: string) => void;
  onToggleAccessory: (id: string) => void;
  onDesign: (design: PetDesign | null) => void;
  /** Opens the premium screen; omitted when premium isn't on sale. */
  onPremium?: () => void;
  /** Opens the league; omitted without a backend. */
  onLeague?: () => void;
}

/** The pet's home: adoption, growth, today's challenge, accessories, abilities, sharing and the premium designer. */
export function PetScreen(props: Props) {
  const { pet, xp } = props;
  if (!pet) return <Adopt onAdopt={props.onAdopt} />;
  return <PetHome {...props} pet={pet} xp={xp} />;
}

function Adopt({ onAdopt }: { onAdopt: Props['onAdopt'] }) {
  const [species, setSpecies] = useState(SPECIES[0].id);
  const [name, setName] = useState('');
  return (
    <form
      className="pet-adopt"
      onSubmit={(e) => {
        e.preventDefault();
        onAdopt(species, name);
      }}
    >
      <div className="big-emoji pop" aria-hidden="true">
        🥚
      </div>
      <h2>בחרו חיה שתלווה אתכם</h2>
      <p className="muted">
        היא תבקע בשיעור הראשון, תגדל ככל שתתקדמו באנגלית, תקבל אביזרים ויכולות חדשות – ותעודד אתכם כל הדרך.
      </p>
      <div className="pet-species" role="radiogroup" aria-label="סוג החיה">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={species === s.id}
            className={`pet-species-item${species === s.id ? ' selected' : ''}`}
            onClick={() => setSpecies(s.id)}
          >
            <span aria-hidden="true">{s.looks[2]}</span>
            <span>{s.name}</span>
          </button>
        ))}
      </div>
      <label className="pet-name-field">
        <span>איך תקראו לה?</span>
        <input
          value={name}
          maxLength={16}
          placeholder={SPECIES.find((s) => s.id === species)?.name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button type="submit" className="btn primary wide">
        🐾 אימוץ
      </button>
    </form>
  );
}

function PetHome(props: Props & { pet: PetState }) {
  const { pet, xp, streak, today } = props;
  const [shared, setShared] = useState<string | null>(null);
  const [designing, setDesigning] = useState(false);
  const look = petLook(pet, xp);
  const next = xpToNextStage(xp);
  const challenge = todaysChallenge(today);
  const status = challengeStatus(pet, today);
  const [seed] = useState(() => Date.now());

  if (designing) {
    return (
      <PetDesigner
        pet={pet}
        xp={xp}
        canUseAi={props.canDesignWithAi}
        onSave={(design) => {
          props.onDesign(design);
          setDesigning(false);
        }}
        onCancel={() => setDesigning(false)}
      />
    );
  }

  async function share() {
    const text = shareText(pet, xp, streak);
    try {
      if (navigator.share) {
        await navigator.share({ title: pet.name, text });
        setShared('שותף!');
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared('הטקסט הועתק – הדביקו אותו לחברים');
    } catch {
      // Cancelled or blocked: nothing to say.
    }
  }

  return (
    <div className="pet-screen">
      <section className="pet-hero" style={{ '--pet-color': look.color } as CSSProperties}>
        <PetAvatar pet={pet} xp={xp} size="large" interactive />
        <h2>{pet.name}</h2>
        <span className="pet-stage-chip">
          שלב {look.stage + 1}/{STAGES.length}: {STAGES[look.stage].name}
        </span>
        <p className="pet-bubble" role="status">
          {look.stage === 0
            ? 'אני עוד בביצה… סיימו שיעור ואני בוקעת! 🐣'
            : greetingLine(pet, props.practicedToday, streak, seed)}
        </p>
        {pet.design?.bio && <p className="muted pet-bio">{pet.design.bio}</p>}
        {next ? (
          <div className="pet-next">
            <div
              className="progress-track small"
              role="progressbar"
              aria-label={`התקדמות לשלב ${next.next.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(next.fraction * 100)}
            >
              <div className="progress-fill" style={{ width: `${next.fraction * 100}%` }} />
            </div>
            <span className="muted">
              עוד {next.remaining} XP לשלב הבא: {next.next.name}
            </span>
          </div>
        ) : (
          <span className="muted">הגעתם לשלב האחרון. אגדה! 🌟</span>
        )}
      </section>

      <h3>⚡ האתגר של היום</h3>
      {hasAbility(xp, 'challenge') ? (
        <div className={`pet-challenge${status.claimed ? ' done' : ''}`}>
          <span className="quest-icon" aria-hidden="true">
            {status.claimed ? '✅' : challenge.icon}
          </span>
          <div className="quest-body">
            <div className="quest-head">
              <span>{challenge.title}</span>
              <span className="quest-gems">💎 {challengeGems(challenge, xp)}</span>
            </div>
            <div
              className="progress-track small"
              role="progressbar"
              aria-label={challenge.title}
              aria-valuemin={0}
              aria-valuemax={challenge.goal}
              aria-valuenow={status.progress}
            >
              <div
                className="progress-fill gem"
                style={{ width: `${(Math.min(challenge.goal, status.progress) / challenge.goal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="muted">
          ב{STAGES[2].name} ({STAGES[2].xp} XP) {pet.name} תתחיל להציע לכם אתגר יומי עם פרס.
        </p>
      )}

      <h3>🎒 אביזרים</h3>
      <div className="avatar-grid pet-wardrobe">
        {ACCESSORIES.map((a) => {
          const owned = pet.accessories.includes(a.id);
          const worn = pet.worn[a.slot] === a.id;
          return (
            <button
              key={a.id}
              type="button"
              className={`avatar-item pet-acc-item${owned ? ' owned' : ''}${worn ? ' selected' : ''}`}
              disabled={!owned || look.stage === 0}
              aria-pressed={worn}
              onClick={() => props.onToggleAccessory(a.id)}
              aria-label={owned ? `${a.name}${worn ? ' (עליה)' : ''}` : `${a.name} – נפתח ב: ${a.hint}`}
            >
              <span className="avatar-emoji" aria-hidden="true">
                {owned ? a.icon : '🔒'}
              </span>
              <span className="avatar-name">{a.name}</span>
              <span className="avatar-price">{owned ? (worn ? '✓ עליה' : 'ללבוש') : a.hint}</span>
            </button>
          );
        })}
      </div>

      <h3>🌱 יכולות ושלבים</h3>
      <ol className="pet-abilities">
        {ABILITIES.map((a) => {
          const open = look.stage >= a.stage;
          return (
            <li key={a.id} className={open ? 'open' : ''}>
              <span aria-hidden="true">{open ? a.icon : '🔒'}</span>
              <div>
                <strong>{a.title}</strong>
                <span className="muted">
                  {a.description}
                  {!open && ` · נפתח בשלב ${STAGES[a.stage].name} (${STAGES[a.stage].xp} XP)`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <h3>👫 עם חברים</h3>
      {props.onLeague && (
        <p className="muted">
          {pet.name} מופיעה ליד השם שלכם בדירוג של הקבוצות שלכם. כשהקבוצה משלימה אתגר שבועי, כל החיות בקבוצה מקבלות פרס
          משותף:{' '}
          {ACCESSORIES.filter((a) => a.group)
            .map((a) => `${a.icon} ${a.name}`)
            .join(', ')}
          .
        </p>
      )}
      <div className="pet-social">
        <button type="button" className="btn secondary" onClick={() => void share()}>
          📤 שתפו את {pet.name}
        </button>
        {props.onLeague && (
          <button type="button" className="btn secondary" onClick={props.onLeague}>
            👥 לקבוצות שלי
          </button>
        )}
        {shared && (
          <p className="muted" role="status">
            {shared}
          </p>
        )}
      </div>

      <h3>✨ חיה ייחודית (פרימיום)</h3>
      {props.premium ? (
        <div className="pet-premium">
          <p className="muted">עצבו חיה משלכם: מראה, צבע, תכונות מיוחדות ואישיות – בעזרת בינה מלאכותית או ידנית.</p>
          <div className="pet-social">
            <button type="button" className="btn primary" onClick={() => setDesigning(true)}>
              🎨 {pet.design ? 'עריכת העיצוב' : 'לעצב חיה ייחודית'}
            </button>
            {pet.design && (
              <button type="button" className="btn ghost" onClick={() => props.onDesign(null)}>
                חזרה ל{SPECIES.find((s) => s.id === pet.species)?.name}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pet-premium locked">
          <p className="muted">
            מנויי פרימיום יכולים לעצב חיה ייחודית בעזרת בינה מלאכותית – עם מראה, תכונות ואישיות משלה.
          </p>
          {props.onPremium && (
            <button type="button" className="btn secondary" onClick={props.onPremium}>
              לפרטים על פרימיום
            </button>
          )}
        </div>
      )}
    </div>
  );
}
