import { MAX_HEARTS } from '../lib/progress';
import { Icon } from './Icon';

interface Props {
  streak: number;
  xp: number;
  hearts: number;
  gems: number;
  /** Opens the gem shop. */
  onGems: () => void;
  /** The signed-in learner is a premium member (shows a badge under the name). */
  premium?: boolean;
  /** The learner's display name; null for a guest. */
  name: string | null;
  /** The avatar bought with gems, if one was chosen. */
  avatar?: string | null;
  /** Opens the profile screen. */
  onProfile: () => void;
}

export function TopBar({ streak, xp, hearts, gems, onGems, premium, name, avatar, onProfile }: Props) {
  return (
    <header className="top-bar">
      <button type="button" className="profile-chip" onClick={onProfile} aria-label="לפרופיל">
        <span className={`avatar${avatar ? ' bought' : ''}`} aria-hidden="true">
          {avatarFace(name, avatar)}
        </span>
        <span className="profile-chip-info">
          <span className="profile-chip-name" dir="auto">
            {name ?? 'אורח/ת'}
          </span>
          {premium && <PremiumBadge />}
        </span>
      </button>
      <div className="top-stats">
        <span title="רצף ימים" className={streak > 0 ? 'stat streak-stat on' : 'stat streak-stat'}>
          <Icon name="flame" filled={streak > 0} size={22} /> {streak}
        </span>
        <span title="נקודות ניסיון" className="stat xp-stat">
          <Icon name="star" filled size={22} /> {xp}
        </span>
        <span className="stat hearts-stat" title={`לבבות (מקסימום ${MAX_HEARTS}, ועוד לבבות בונוס)`}>
          <Icon name="heart" filled size={22} /> {hearts}
        </span>
        <button type="button" className="stat gem-stat" onClick={onGems} aria-label={`${gems} יהלומים – לחנות`}>
          <Icon name="gem" filled size={22} /> {gems}
        </button>
      </div>
      <span className="brand-name" dir="ltr" title="Baktana English">
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Baktana English" />
        <span>
          Baktana<b>English</b>
        </span>
      </span>
    </header>
  );
}

/** The "you're premium" mark, used in the top bar and on the profile. */
export function PremiumBadge() {
  return (
    <span className="premium-badge" dir="rtl" title="מנוי פרימיום פעיל">
      <Icon name="crown" filled />
      <span className="premium-label"> פרימיום</span>
    </span>
  );
}

/** What the avatar circle shows: the bought avatar, else the name's first letter. */
export function avatarFace(name: string | null, avatar?: string | null): string {
  return avatar ?? (name?.trim().charAt(0).toUpperCase() || '🙂');
}
