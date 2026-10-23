import { useState } from 'react';
import {
  MAX_DESIGN_PROMPT,
  MAX_PET_BIO,
  MAX_PET_NAME,
  MAX_TRAITS,
  PERSONALITIES,
  PET_BASES,
  PET_COLORS,
  PET_TRAITS,
  parsePetDesign,
  type PetDesign,
} from '../../../shared/pet-design';
import { errorMessage } from '../../lib/api';
import { designPet } from '../../lib/call-api';
import { applyDesign, STAGES, type PetState } from '../../lib/pet';
import { PetAvatar } from './PetAvatar';

interface Props {
  pet: PetState;
  xp: number;
  /** A backend is there to design with AI. */
  canUseAi: boolean;
  onSave: (design: PetDesign) => void;
  onCancel: () => void;
}

function startingDesign(pet: PetState): PetDesign {
  return (
    pet.design ?? {
      name: pet.name,
      base: PET_BASES[0],
      color: PET_COLORS[0].id,
      traits: [],
      personality: 'cheerful',
      bio: '',
    }
  );
}

/** Premium: design a unique pet – describe it to the AI, then fine-tune every part by hand. */
export function PetDesigner({ pet, xp, canUseAi, onSave, onCancel }: Props) {
  const [design, setDesign] = useState<PetDesign>(() => startingDesign(pet));
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<PetDesign>) => setDesign((d) => ({ ...d, ...patch }));
  // The preview shows the pet hatched, even for a learner whose pet is still an egg.
  const previewXp = Math.max(xp, STAGES[1].xp);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      // Refine an existing design; a new one starts from the wish alone.
      setDesign(await designPet({ prompt, current: pet.design ? design : undefined }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const valid = parsePetDesign(design);

  return (
    <form
      className="pet-designer"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(valid);
      }}
    >
      <h2>🎨 עיצוב חיה ייחודית</h2>
      <div className="pet-hero">
        <PetAvatar pet={applyDesign(pet, design)} xp={previewXp} size="large" />
        <strong>{design.name || '—'}</strong>
      </div>

      {canUseAi && (
        <fieldset className="pet-ai">
          <legend>✨ תארו לבינה המלאכותית</legend>
          <textarea
            value={prompt}
            maxLength={MAX_DESIGN_PROMPT}
            rows={3}
            placeholder="למשל: דרקון סגול קטן שאוהב מוזיקה ומספר בדיחות"
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn secondary"
            disabled={busy || !prompt.trim()}
            onClick={() => void generate()}
          >
            {busy ? 'מעצבים…' : '✨ עיצוב עם AI'}
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
      )}

      <label className="pet-name-field">
        <span>שם</span>
        <input value={design.name} maxLength={MAX_PET_NAME} onChange={(e) => change({ name: e.target.value })} />
      </label>

      <fieldset>
        <legend>מראה</legend>
        <div className="pet-choice-grid">
          {PET_BASES.map((base) => (
            <button
              key={base}
              type="button"
              className={`pet-choice${design.base === base ? ' selected' : ''}`}
              aria-pressed={design.base === base}
              onClick={() => change({ base })}
            >
              {base}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>צבע</legend>
        <div className="pet-choice-grid">
          {PET_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`pet-color${design.color === c.id ? ' selected' : ''}`}
              style={{ background: c.hex }}
              aria-pressed={design.color === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => change({ color: c.id })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>תכונות מיוחדות (עד {MAX_TRAITS})</legend>
        <div className="pet-choice-grid">
          {PET_TRAITS.map((t) => {
            const on = design.traits.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`pet-chip${on ? ' selected' : ''}`}
                aria-pressed={on}
                disabled={!on && design.traits.length >= MAX_TRAITS}
                onClick={() =>
                  change({ traits: on ? design.traits.filter((id) => id !== t.id) : [...design.traits, t.id] })
                }
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>אישיות</legend>
        <div className="pet-choice-grid">
          {PERSONALITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pet-chip${design.personality === p.id ? ' selected' : ''}`}
              aria-pressed={design.personality === p.id}
              title={p.description}
              onClick={() => change({ personality: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="pet-name-field">
        <span>כמה מילים עליה</span>
        <textarea
          value={design.bio}
          maxLength={MAX_PET_BIO}
          rows={2}
          onChange={(e) => change({ bio: e.target.value })}
        />
      </label>

      <div className="pet-social">
        <button type="submit" className="btn primary" disabled={!valid}>
          שמירה
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  );
}
