import { useEffect, useState } from 'react';
import {
  HOME_ITEMS,
  HOME_KIND_TITLES,
  HELP_MINUTES,
  currentHouse,
  formatDuration,
  homeItem,
  homeProgress,
  projectFraction,
  remainingMinutes,
  rushCost,
  startBlock,
  type HomeKind,
  type StartBlock,
} from '../../lib/pet-home';
import type { PetState } from '../../lib/pet';
import { PetAvatar } from './PetAvatar';
import { Icon } from '../Icon';

/** Re-renders every `ms` so countdowns stay fresh. */
export function useNow(ms = 20_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

interface Props {
  pet: PetState;
  xp: number;
  gems: number;
  hatched: boolean;
  onStart: (id: string) => void;
  onRush: () => void;
  onWear: (id: string) => void;
}

const BLOCK_TEXT: Partial<Record<StartBlock, string>> = {
  busy: 'יש פרויקט בעבודה',
  unhatched: 'אחרי שהחיה תבקע',
};

/** The pet's home: a scene that fills up as things get built, the running project and what can be built next. */
export function PetHouse({ pet, xp, gems, hatched, onStart, onRush, onWear }: Props) {
  const now = useNow();
  const { home } = pet;
  const house = currentHouse(home);
  const project = home.project ? homeItem(home.project.id) : undefined;
  const { done, total } = homeProgress(home);
  const left = remainingMinutes(home, now);
  const decor = HOME_ITEMS.filter((i) => i.kind === 'decor' && home.built.includes(i.id));
  const kinds: HomeKind[] = ['house', 'decor', 'wear'];

  return (
    <section className="pet-home" aria-label={`הבית של ${pet.name}`}>
      <h3>
        <Icon name="house" /> הבית של {pet.name}
      </h3>
      <div className={`home-scene${house ? ` level-${house.id}` : ''}`}>
        <div className="home-sky" aria-hidden="true" />
        <div className="home-ground" aria-hidden="true" />
        <span className="home-house" aria-hidden="true">
          {house ? house.icon : '🌱'}
        </span>
        {decor.map((d) => (
          <span key={d.id} className={`home-decor d-${d.id}`} aria-hidden="true">
            {d.icon}
          </span>
        ))}
        {project && (
          <span className="home-works" aria-hidden="true">
            🚧
          </span>
        )}
        <div className="home-pet">
          <PetAvatar pet={pet} xp={xp} size="medium" />
        </div>
      </div>
      <p className="muted home-count">
        {done}/{total} פריטים בנויים
        {!house && ' · אין עדיין גג מעל הראש. בנו אוהל!'}
      </p>

      {project && home.project && (
        <div className="home-project" role="status">
          <div className="quest-head">
            <span>
              <span aria-hidden="true">{project.icon}</span> בונים: {project.name}
            </span>
            <span className="muted">{left > 0 ? `עוד ${formatDuration(left)}` : 'כמעט מוכן…'}</span>
          </div>
          <div
            className="progress-track small"
            role="progressbar"
            aria-label={`התקדמות הבנייה: ${project.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(projectFraction(home, now) * 100)}
          >
            <div className="progress-fill gem" style={{ width: `${projectFraction(home, now) * 100}%` }} />
          </div>
          <p className="muted home-tip">
            כל שיעור או חזרה מקצרים את הבנייה ב־{HELP_MINUTES} דקות. אפשר גם להאיץ בג׳מס.
          </p>
          <button type="button" className="btn secondary" disabled={gems < rushCost(home, now)} onClick={onRush}>
            <Icon name="zap" /> האצה · <Icon name="gem" /> {rushCost(home, now)}
          </button>
        </div>
      )}

      {kinds.map((kind) => (
        <div key={kind} className="home-group">
          <h4>{HOME_KIND_TITLES[kind]}</h4>
          <ul className="home-items">
            {HOME_ITEMS.filter((i) => i.kind === kind).map((item) => {
              const built = home.built.includes(item.id);
              const building = home.project?.id === item.id;
              const block = startBlock(home, item.id, gems, hatched);
              const req = item.requires ? homeItem(item.requires) : undefined;
              const worn = home.outfit === item.id;
              return (
                <li key={item.id} className={`home-item${built ? ' built' : ''}${building ? ' building' : ''}`}>
                  <span className="home-item-icon" aria-hidden="true">
                    {block === 'locked' ? <Icon name="lock" /> : item.icon}
                  </span>
                  <span className="home-item-text">
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {built
                        ? 'בנוי'
                        : building
                          ? 'בבנייה…'
                          : block === 'locked' && req
                            ? `דורש: ${req.name}`
                            : `${formatDuration(item.minutes)}`}
                    </span>
                  </span>
                  {item.kind === 'wear' && built ? (
                    <button
                      type="button"
                      className="btn secondary home-btn"
                      aria-pressed={worn}
                      onClick={() => onWear(item.id)}
                    >
                      {worn ? (
                        <>
                          <Icon name="check" /> לובשת
                        </>
                      ) : (
                        'ללבוש'
                      )}
                    </button>
                  ) : built ? (
                    <Icon name="circle-check" />
                  ) : building ? (
                    <Icon name="hourglass" />
                  ) : block === 'locked' ? (
                    <Icon name="lock" />
                  ) : (
                    <button
                      type="button"
                      className="btn primary home-btn"
                      disabled={block !== null}
                      title={block ? BLOCK_TEXT[block] : undefined}
                      aria-label={`לבנות ${item.name}, ${item.gems} ג׳מס, ${formatDuration(item.minutes)}`}
                      onClick={() => onStart(item.id)}
                    >
                      <Icon name="gem" /> {item.gems}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
