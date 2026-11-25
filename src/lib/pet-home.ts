/**
 * The pet's home 🏡: a place that is built and renovated over real time. Each project (a bigger house,
 * a bed, a new shirt…) costs gems and takes minutes or hours to finish – one at a time – so the pet
 * visibly progresses every so often. Finishing lessons speeds the work up; gems can rush it.
 * Kept inside the pet's state (localStorage), so the progress contract with the server is unchanged.
 */

export type HomeKind = 'house' | 'decor' | 'wear';

export interface HomeItem {
  id: string;
  kind: HomeKind;
  icon: string;
  name: string;
  /** Gems to start the project. */
  gems: number;
  /** How long the work takes. */
  minutes: number;
  /** An item that must be finished first. */
  requires?: string;
}

/** The house grows level by level; decor needs a roof first; clothes are independent. */
export const HOME_ITEMS: HomeItem[] = [
  { id: 'tent', kind: 'house', icon: '⛺', name: 'אוהל', gems: 10, minutes: 5 },
  { id: 'hut', kind: 'house', icon: '🛖', name: 'בקתה', gems: 40, minutes: 60, requires: 'tent' },
  { id: 'cottage', kind: 'house', icon: '🏠', name: 'בית קטן', gems: 90, minutes: 4 * 60, requires: 'hut' },
  { id: 'house', kind: 'house', icon: '🏡', name: 'בית עם גינה', gems: 180, minutes: 12 * 60, requires: 'cottage' },
  { id: 'castle', kind: 'house', icon: '🏰', name: 'ארמון', gems: 400, minutes: 24 * 60, requires: 'house' },

  { id: 'bed', kind: 'decor', icon: '🛏️', name: 'מיטה', gems: 20, minutes: 15, requires: 'tent' },
  { id: 'plant', kind: 'decor', icon: '🪴', name: 'עציץ', gems: 15, minutes: 20, requires: 'tent' },
  { id: 'lamp', kind: 'decor', icon: '💡', name: 'מנורה', gems: 25, minutes: 45, requires: 'hut' },
  { id: 'books', kind: 'decor', icon: '📚', name: 'ספרייה', gems: 45, minutes: 90, requires: 'hut' },
  { id: 'fire', kind: 'decor', icon: '🔥', name: 'אח', gems: 60, minutes: 3 * 60, requires: 'cottage' },
  { id: 'tree', kind: 'decor', icon: '🌳', name: 'עץ בגינה', gems: 70, minutes: 5 * 60, requires: 'cottage' },
  { id: 'scope', kind: 'decor', icon: '🔭', name: 'טלסקופ', gems: 120, minutes: 8 * 60, requires: 'house' },
  { id: 'pool', kind: 'decor', icon: '🏊', name: 'בריכה', gems: 150, minutes: 16 * 60, requires: 'house' },

  { id: 'shirt', kind: 'wear', icon: '👕', name: 'חולצה', gems: 15, minutes: 10 },
  { id: 'vest', kind: 'wear', icon: '🦺', name: 'אפוד', gems: 35, minutes: 60 },
  { id: 'jacket', kind: 'wear', icon: '🧥', name: "ז'קט", gems: 70, minutes: 4 * 60 },
  { id: 'kimono', kind: 'wear', icon: '🥋', name: 'חגורה שחורה', gems: 110, minutes: 10 * 60 },
  { id: 'labcoat', kind: 'wear', icon: '🥼', name: 'חלוק מדענים', gems: 160, minutes: 24 * 60 },
];

export const HOME_KIND_TITLES: Record<HomeKind, string> = {
  house: 'הבית',
  decor: 'ריהוט וגינה',
  wear: 'בגדים',
};

/** Every finished lesson, review or practice takes this long off the current project. */
export const HELP_MINUTES = 15;
/** Rushing costs one gem per this many remaining minutes (at least one gem). */
export const RUSH_MINUTES_PER_GEM = 30;

const MINUTE = 60_000;

export interface HomeProject {
  id: string;
  startedAt: number;
  endsAt: number;
}

export interface HomeState {
  /** Finished items (permanent). */
  built: string[];
  /** The single project being worked on, or null. */
  project: HomeProject | null;
  /** The clothing item worn, or null. */
  outfit: string | null;
}

export const initialHome = (): HomeState => ({ built: [], project: null, outfit: null });

const ITEM_IDS = HOME_ITEMS.map((i) => i.id);

export function homeItem(id: string): HomeItem | undefined {
  return HOME_ITEMS.find((i) => i.id === id);
}

const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Parses a saved home, ignoring anything unknown; a missing or unreadable one is a fresh home. */
export function parseHome(raw: unknown): HomeState {
  if (!raw || typeof raw !== 'object') return initialHome();
  const d = raw as Record<string, unknown>;
  const built = Array.isArray(d.built)
    ? [...new Set(d.built.filter((id): id is string => typeof id === 'string' && ITEM_IDS.includes(id)))]
    : [];
  const p = d.project as Record<string, unknown> | null | undefined;
  const project =
    p && typeof p === 'object' && typeof p.id === 'string' && ITEM_IDS.includes(p.id) && !built.includes(p.id)
      ? { id: p.id, startedAt: time(p.startedAt), endsAt: time(p.endsAt) }
      : null;
  const outfit =
    typeof d.outfit === 'string' && built.includes(d.outfit) && homeItem(d.outfit)?.kind === 'wear' ? d.outfit : null;
  return { built, project, outfit };
}

/** The finished house item with the highest level (the one shown in the scene), or null. */
export function currentHouse(home: HomeState): HomeItem | null {
  const houses = HOME_ITEMS.filter((i) => i.kind === 'house' && home.built.includes(i.id));
  return houses[houses.length - 1] ?? null;
}

/** How many of the home's items are finished, out of all of them. */
export function homeProgress(home: HomeState): { done: number; total: number } {
  return { done: home.built.length, total: HOME_ITEMS.length };
}

export type StartBlock = 'built' | 'busy' | 'locked' | 'unhatched' | 'poor';

/** Why a project can't start now, or null when it can. */
export function startBlock(home: HomeState, id: string, gems: number, hatched: boolean): StartBlock | null {
  const item = homeItem(id);
  if (!item) return 'locked';
  if (home.built.includes(id)) return 'built';
  if (item.requires && !home.built.includes(item.requires)) return 'locked';
  if (home.project) return 'busy';
  if (!hatched) return 'unhatched';
  if (gems < item.gems) return 'poor';
  return null;
}

/** Starts a project (the caller takes the gems), or null when it can't start. */
export function startProject(
  home: HomeState,
  id: string,
  gems: number,
  hatched: boolean,
  now = Date.now(),
): { home: HomeState; cost: number } | null {
  if (startBlock(home, id, gems, hatched) !== null) return null;
  const item = homeItem(id)!;
  return { home: { ...home, project: { id, startedAt: now, endsAt: now + item.minutes * MINUTE } }, cost: item.gems };
}

/**
 * Finishes the project once its time is up. A new piece of clothing is put on when nothing is worn.
 * Returns the same home object when nothing changed.
 */
export function settleHome(home: HomeState, now = Date.now()): { home: HomeState; finished: HomeItem | null } {
  const { project } = home;
  if (!project || project.endsAt > now) return { home, finished: null };
  const item = homeItem(project.id);
  const built = item && !home.built.includes(item.id) ? [...home.built, item.id] : home.built;
  const outfit = home.outfit ?? (item?.kind === 'wear' ? item.id : null);
  return { home: { built, project: null, outfit }, finished: item ?? null };
}

/** Takes minutes off the running project (a finished lesson helps the builders). */
export function helpProject(home: HomeState, minutes = HELP_MINUTES): HomeState {
  if (!home.project) return home;
  const endsAt = Math.max(home.project.startedAt, home.project.endsAt - minutes * MINUTE);
  return { ...home, project: { ...home.project, endsAt } };
}

export function remainingMinutes(home: HomeState, now = Date.now()): number {
  return home.project ? Math.max(0, Math.ceil((home.project.endsAt - now) / MINUTE)) : 0;
}

/** 0..1 of the running project. */
export function projectFraction(home: HomeState, now = Date.now()): number {
  const p = home.project;
  if (!p) return 0;
  const total = p.endsAt - p.startedAt;
  return total <= 0 ? 1 : Math.min(1, Math.max(0, (now - p.startedAt) / total));
}

/** The gems it takes to finish the running project right away. */
export function rushCost(home: HomeState, now = Date.now()): number {
  const left = remainingMinutes(home, now);
  return left <= 0 ? 0 : Math.max(1, Math.ceil(left / RUSH_MINUTES_PER_GEM));
}

/** Finishes the running project now (the caller takes the gems), or null when it can't be afforded. */
export function rushProject(
  home: HomeState,
  gems: number,
  now = Date.now(),
): { home: HomeState; cost: number; finished: HomeItem | null } | null {
  if (!home.project) return null;
  const cost = rushCost(home, now);
  if (gems < cost) return null;
  const settled = settleHome({ ...home, project: { ...home.project, endsAt: now } }, now);
  return { home: settled.home, cost, finished: settled.finished };
}

/** Puts on a finished piece of clothing, or takes it off when it is already worn. */
export function toggleOutfit(home: HomeState, id: string): HomeState {
  if (!home.built.includes(id) || homeItem(id)?.kind !== 'wear') return home;
  return { ...home, outfit: home.outfit === id ? null : id };
}

/** "5 דק׳", "2 שע׳ ו־10 דק׳", "יום". */
export function formatDuration(minutes: number): string {
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? 'יום' : `${days} ימים`;
  }
  if (minutes < 60) return `${Math.max(1, minutes)} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} שע׳ ו־${m} דק׳` : `${h} שע׳`;
}
