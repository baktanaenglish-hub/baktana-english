import { useState } from 'react';
import { greetingLine, type PetState } from '../../lib/pet';
import { PetAvatar } from './PetAvatar';

interface CardProps {
  pet: PetState | null;
  xp: number;
  streak: number;
  practicedToday: boolean;
  onOpen: () => void;
}

/** The pet on the path: its greeting, and the way to its screen (or to adopting one). */
export function PetCard({ pet, xp, streak, practicedToday, onOpen }: CardProps) {
  const [seed] = useState(() => Date.now());
  return (
    <button type="button" className="arcade-card pet-card" onClick={onOpen}>
      {pet ? (
        <PetAvatar pet={pet} xp={xp} size="small" />
      ) : (
        <span className="arcade-card-icon" aria-hidden="true">
          🥚
        </span>
      )}
      <span className="arcade-card-text">
        <strong>{pet ? pet.name : 'חיה אישית'}</strong>
        <span className="muted">
          {pet ? greetingLine(pet, practicedToday, streak, seed) : 'אמצו חיה שתגדל איתכם ככל שתתקדמו באנגלית'}
        </span>
      </span>
      <span className="arcade-card-go" aria-hidden="true">
        ‹
      </span>
    </button>
  );
}

/** The pet's reaction on the lesson-complete screen. */
export function PetBubble({ pet, xp, line }: { pet: PetState; xp: number; line: string }) {
  return (
    <div className="pet-reaction rise">
      <PetAvatar pet={pet} xp={xp} size="small" />
      <p className="pet-bubble">
        <strong>{pet.name}:</strong> {line}
      </p>
    </div>
  );
}
