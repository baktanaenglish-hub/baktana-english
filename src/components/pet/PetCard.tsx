import { useState } from 'react';
import { greetingLine, type PetState } from '../../lib/pet';
import { PetAvatar } from './PetAvatar';
import { Icon } from '../Icon';
import { formatDuration, homeItem, remainingMinutes } from '../../lib/pet-home';
import { useNow } from './PetHouse';

interface CardProps {
  pet: PetState | null;
  xp: number;
  streak: number;
  practicedToday: boolean;
  /** A line about something finished at home, shown instead of the greeting. */
  notice?: string | null;
  onOpen: () => void;
}

/** The pet on the path: its greeting, and the way to its screen (or to adopting one). */
export function PetCard({ pet, xp, streak, practicedToday, notice, onOpen }: CardProps) {
  const [seed] = useState(() => Date.now());
  const now = useNow(30_000);
  const project = pet?.home.project ? homeItem(pet.home.project.id) : undefined;
  return (
    <button type="button" className="arcade-card pet-card" onClick={onOpen}>
      {pet ? (
        <PetAvatar pet={pet} xp={xp} size="small" />
      ) : (
        <span className="arcade-card-icon" aria-hidden="true">
          <Icon name="egg" />
        </span>
      )}
      <span className="arcade-card-text">
        <strong>{pet ? pet.name : 'חיה אישית'}</strong>
        <span className="muted">
          {notice
            ? notice
            : pet && project && pet.home
              ? `בונים ${project.name} ${project.icon} · עוד ${formatDuration(remainingMinutes(pet.home, now))}`
              : pet
                ? greetingLine(pet, practicedToday, streak, seed)
                : 'אמצו חיה שתגדל איתכם ככל שתתקדמו באנגלית'}
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
