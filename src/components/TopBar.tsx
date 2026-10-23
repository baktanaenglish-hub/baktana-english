import { MAX_HEARTS } from '../lib/progress';

interface Props {
  streak: number;
  xp: number;
  hearts: number;
  gems: number;
  /** Opens the gem shop. */
  onGems: () => void;
  /** The signed-in learner is a premium member (shows a badge under the logo). */
  premium?: boolean;
}

export function TopBar({ streak, xp, hearts, gems, onGems, premium }: Props) {
  return (
    <header className="top-bar">
      <div className="brand-mark">
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        {premium && <PremiumBadge />}
      </div>
      <div className="top-stats">
        <span title="רצף ימים" className={streak > 0 ? 'stat streak-stat on' : 'stat streak-stat'}>
          <span>🔥</span> {streak}
        </span>
        <span title="נקודות ניסיון" className="stat">
          <span>⭐</span> {xp}
        </span>
        <span className="stat" title={`לבבות (מקסימום ${MAX_HEARTS}, ועוד לבבות בונוס)`}>
          <span>❤️</span> {hearts}
        </span>
        <button type="button" className="stat gem-stat" onClick={onGems} aria-label={`${gems} יהלומים – לחנות`}>
          <span>💎</span> {gems}
        </button>
      </div>
      <span className="brand-name" dir="ltr">
        Baktana<b>English</b>
      </span>
    </header>
  );
}

/** The "you're premium" mark, used in the top bar and on the profile. */
export function PremiumBadge() {
  return (
    <span className="premium-badge" dir="rtl" title="מנוי פרימיום פעיל">
      👑<span className="premium-label"> פרימיום</span>
    </span>
  );
}
