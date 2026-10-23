import { useState, type CSSProperties } from 'react';
import { accessoryById, hasAbility, petLook, STAGES, type PetState } from '../../lib/pet';

interface Props {
  pet: PetState;
  xp: number;
  size?: 'small' | 'medium' | 'large';
  /** From stage 3 a tap makes the pet do a trick. */
  interactive?: boolean;
}

/** The pet as it looks now: stage, glow color, premium traits and worn accessories. */
export function PetAvatar({ pet, xp, size = 'medium', interactive = false }: Props) {
  const look = petLook(pet, xp);
  const [trick, setTrick] = useState(0);
  const canTrick = interactive && hasAbility(xp, 'tricks');
  const worn = (['head', 'face', 'neck'] as const)
    .map((slot) => pet.worn[slot] && accessoryById(pet.worn[slot]!))
    .filter((a) => !!a);
  const label = `${pet.name} – ${STAGES[look.stage].name}${worn.length ? `, עם ${worn.map((a) => a.name).join(', ')}` : ''}`;
  const className = `pet-avatar ${size} stage-${look.stage}${trick ? ` trick-${trick % 3}` : ''}`;
  const style = { '--pet-color': look.color } as CSSProperties;
  const body = (
    <>
      <span className="pet-glow" aria-hidden="true" />
      {look.traits.map((icon, i) => (
        <span key={i} className={`pet-trait t${i}`} aria-hidden="true">
          {icon}
        </span>
      ))}
      <span className="pet-body" aria-hidden="true">
        {look.emoji}
      </span>
      {look.stage > 0 &&
        worn.map((a) => (
          <span key={a.id} className={`pet-acc ${a.slot}`} aria-hidden="true">
            {a.icon}
          </span>
        ))}
    </>
  );
  if (canTrick) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        aria-label={`${label}. הקישו לטריק`}
        onClick={() => setTrick((n) => n + 1)}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={className} style={style} role="img" aria-label={label}>
      {body}
    </div>
  );
}
