/**
 * The personal pet 🐾: a companion that grows with the learner. It doesn't teach – it cheers on
 * achievements, reacts to progress, offers a daily challenge, signs the daily reminders and
 * evolves (new stages, accessories and abilities) as the learner earns XP and keeps a streak.
 * Premium learners can design a unique pet (shared/pet-design.ts), with AI or by hand.
 * Kept in localStorage only, like the gems, so the progress contract with the server stays unchanged.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  PET_COLORS,
  PET_TRAITS,
  parsePetDesign,
  type Personality,
  type PetBadge,
  type PetDesign,
} from '../../shared/pet-design';
import { dateKey } from './progress';

export const PET_KEY = 'baktana-english:pet:v1';

export interface Species {
  id: string;
  name: string;
  /** What the pet looks like at each stage after hatching (stages 1–4). */
  looks: [string, string, string, string];
  personality: Personality;
  /** Background glow (a PET_COLORS id). */
  color: string;
}

export const SPECIES: Species[] = [
  { id: 'dragon', name: 'דרקון', looks: ['🦎', '🐲', '🐉', '🐉'], personality: 'brave', color: 'forest' },
  { id: 'owl', name: 'ינשוף', looks: ['🐣', '🐥', '🦉', '🦉'], personality: 'calm', color: 'lilac' },
  { id: 'tiger', name: 'נמר', looks: ['🐱', '🐯', '🐅', '🐅'], personality: 'funny', color: 'sun' },
  { id: 'unicorn', name: 'חד־קרן', looks: ['🐴', '🦄', '🦄', '🦄'], personality: 'cheerful', color: 'berry' },
];

export interface Stage {
  name: string;
  /** Total XP needed. */
  xp: number;
}

/** The pet hatches with the first lesson and evolves with XP. */
export const STAGES: Stage[] = [
  { name: 'ביצה', xp: 0 },
  { name: 'גור', xp: 10 },
  { name: 'מתבגר', xp: 200 },
  { name: 'בוגר', xp: 600 },
  { name: 'אגדה', xp: 1500 },
];

/** Gems the pet brings when it reaches a stage: 20 × the stage. */
export const EVOLVE_GEMS = 20;

export interface Ability {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** The stage that unlocks it. */
  stage: number;
}

export const ABILITIES: Ability[] = [
  { id: 'cheer', icon: '👏', title: 'מחמאות', description: 'מגיבה לכל הישג שלכם', stage: 1 },
  { id: 'remind', icon: '🔔', title: 'תזכורות אישיות', description: 'התזכורת היומית מגיעה ממנה', stage: 1 },
  { id: 'challenge', icon: '⚡', title: 'אתגר יומי', description: 'מציעה כל יום אתגר עם פרס', stage: 2 },
  { id: 'tricks', icon: '🎪', title: 'טריקים', description: 'הקישו עליה והיא עושה טריק', stage: 3 },
  { id: 'aura', icon: '🌟', title: 'הילה אגדית', description: 'זוהרת בזהב ומכפילה את פרס האתגר', stage: 4 },
];

export type Slot = 'head' | 'face' | 'neck';

export interface Accessory {
  id: string;
  icon: string;
  name: string;
  slot: Slot;
  /** How it is earned, shown while locked. */
  hint: string;
  earned: (m: Milestones) => boolean;
  /** A shared prize of group challenges. */
  group?: boolean;
}

/** What accessories are earned by. */
export interface Milestones {
  xp: number;
  lessons: number;
  streak: number;
  /** Group challenges whose prize the learner collected (the pet keeps the count, see recordGroupChallenge). */
  groupChallenges?: number;
  /** Head-to-head duels won (the pet keeps the count, see recordDuelWin). */
  duelWins?: number;
}

export const ACCESSORIES: Accessory[] = [
  { id: 'scarf', icon: '🧣', name: 'צעיף', slot: 'neck', hint: 'שיעור ראשון', earned: (m) => m.lessons >= 1 },
  { id: 'cap', icon: '🧢', name: 'כובע מצחייה', slot: 'head', hint: 'רצף של 3 ימים', earned: (m) => m.streak >= 3 },
  { id: 'bow', icon: '🎀', name: 'פפיון', slot: 'head', hint: 'רצף של 7 ימים', earned: (m) => m.streak >= 7 },
  {
    id: 'headphones',
    icon: '🎧',
    name: 'אוזניות',
    slot: 'head',
    hint: '10 שיעורים',
    earned: (m) => m.lessons >= 10,
  },
  { id: 'glasses', icon: '🕶️', name: 'משקפי שמש', slot: 'face', hint: '500 XP', earned: (m) => m.xp >= 500 },
  { id: 'grad', icon: '🎓', name: 'כובע סיום', slot: 'head', hint: '30 שיעורים', earned: (m) => m.lessons >= 30 },
  { id: 'medal', icon: '🏅', name: 'מדליה', slot: 'neck', hint: 'רצף של 14 ימים', earned: (m) => m.streak >= 14 },
  { id: 'tophat', icon: '🎩', name: 'מגבעת', slot: 'head', hint: '2,000 XP', earned: (m) => m.xp >= 2000 },
  { id: 'crown', icon: '👑', name: 'כתר', slot: 'head', hint: 'רצף של 30 ימים', earned: (m) => m.streak >= 30 },
  // Shared prizes: every member who collects a completed group challenge gets them for their pet.
  {
    id: 'ribbon',
    icon: '🎗️',
    name: 'סרט הקבוצה',
    slot: 'neck',
    hint: 'אתגר קבוצתי',
    earned: (m) => (m.groupChallenges ?? 0) >= 1,
    group: true,
  },
  {
    id: 'team-medal',
    icon: '🎖️',
    name: 'עיטור הקבוצה',
    slot: 'neck',
    hint: '5 אתגרים קבוצתיים',
    earned: (m) => (m.groupChallenges ?? 0) >= 5,
    group: true,
  },
  {
    id: 'gold-medal',
    icon: '🥇',
    name: 'מדליית ניצחון',
    slot: 'neck',
    hint: 'ניצחון בתחרות ראש בראש',
    earned: (m) => (m.duelWins ?? 0) >= 1,
  },
];

export type ChallengeKind = 'lessons' | 'flawless' | 'review' | 'xp';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  icon: string;
  title: string;
  goal: number;
  gems: number;
}

/** One of these is offered each day (from stage 2). */
export const CHALLENGES: Challenge[] = [
  { id: 'lessons3', kind: 'lessons', icon: '📚', title: '3 שיעורים היום', goal: 3, gems: 25 },
  { id: 'flawless2', kind: 'flawless', icon: '🎯', title: '2 שיעורים בלי אף טעות', goal: 2, gems: 30 },
  { id: 'review2', kind: 'review', icon: '🧠', title: '2 חזרות או תרגולים', goal: 2, gems: 20 },
  { id: 'xp60', kind: 'xp', icon: '⚡', title: '60 XP היום', goal: 60, gems: 25 },
  { id: 'lessons2', kind: 'lessons', icon: '📘', title: '2 שיעורים היום', goal: 2, gems: 15 },
];

export interface PetState {
  /** A SPECIES id (kept while a premium design is used, to switch back to). */
  species: string;
  name: string;
  adoptedAt: number;
  /** The highest stage the learner has already seen (and been paid for). */
  stageSeen: number;
  /** Earned accessory ids; earning is permanent, even if the streak is lost later. */
  accessories: string[];
  /** Worn accessory per slot. */
  worn: Partial<Record<Slot, string>>;
  /** A premium design that replaces the species' look and personality, or null. */
  design: PetDesign | null;
  /** The day `challengeProgress` and `challengeClaimed` belong to. */
  challengeDate: string | null;
  challengeProgress: number;
  challengeClaimed: boolean;
  /** Group challenges whose prize was collected (shared prizes, see ACCESSORIES). */
  groupChallenges: number;
  /** Head-to-head duels won. */
  duelWins: number;
}

const SLOTS: Slot[] = ['head', 'face', 'neck'];
const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id);

export function adoptPet(speciesId: string, name: string, now = Date.now()): PetState | null {
  const species = SPECIES.find((s) => s.id === speciesId);
  const clean = name.trim().slice(0, 16);
  if (!species) return null;
  return {
    species: species.id,
    name: clean || species.name,
    adoptedAt: now,
    stageSeen: 0,
    accessories: [],
    worn: {},
    design: null,
    challengeDate: null,
    challengeProgress: 0,
    challengeClaimed: false,
    groupChallenges: 0,
    duelWins: 0,
  };
}

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Parses the saved pet, or null when there is none (or it is unreadable). */
export function parsePet(raw: string | null): PetState | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (!d || typeof d !== 'object') return null;
    if (!SPECIES.some((s) => s.id === d.species)) return null;
    const accessories = Array.isArray(d.accessories)
      ? [...new Set(d.accessories.filter((id): id is string => ACCESSORY_IDS.includes(id as string)))]
      : [];
    const wornRaw = (d.worn && typeof d.worn === 'object' ? d.worn : {}) as Record<string, unknown>;
    const worn: Partial<Record<Slot, string>> = {};
    for (const slot of SLOTS) {
      const id = wornRaw[slot];
      if (typeof id === 'string' && accessories.includes(id) && accessoryById(id)?.slot === slot) worn[slot] = id;
    }
    const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : 'חבר';
    return {
      species: d.species as string,
      name,
      adoptedAt: count(d.adoptedAt),
      stageSeen: Math.min(STAGES.length - 1, count(d.stageSeen)),
      accessories,
      worn,
      design: d.design ? parsePetDesign(d.design) : null,
      challengeDate: typeof d.challengeDate === 'string' ? d.challengeDate : null,
      challengeProgress: count(d.challengeProgress),
      challengeClaimed: d.challengeClaimed === true,
      groupChallenges: count(d.groupChallenges),
      duelWins: count(d.duelWins),
    };
  } catch {
    return null;
  }
}

export function accessoryById(id: string): Accessory | undefined {
  return ACCESSORIES.find((a) => a.id === id);
}

export function speciesOf(pet: PetState): Species {
  return SPECIES.find((s) => s.id === pet.species) ?? SPECIES[0];
}

export function stageFor(xp: number): number {
  let stage = 0;
  STAGES.forEach((s, i) => {
    if (xp >= s.xp) stage = i;
  });
  return stage;
}

/** XP still needed for the next stage, or null at the last one. */
export function xpToNextStage(xp: number): { next: Stage; remaining: number; fraction: number } | null {
  const stage = stageFor(xp);
  const next = STAGES[stage + 1];
  if (!next) return null;
  const from = STAGES[stage].xp;
  return { next, remaining: next.xp - xp, fraction: (xp - from) / (next.xp - from) };
}

export function personalityOf(pet: PetState): Personality {
  return pet.design?.personality ?? speciesOf(pet).personality;
}

export interface PetLook {
  emoji: string;
  /** Glow color (hex). */
  color: string;
  /** Feature icons shown around the pet (premium traits). */
  traits: string[];
  stage: number;
}

/** What the pet looks like at the learner's XP. */
export function petLook(pet: PetState, xp: number): PetLook {
  const stage = stageFor(xp);
  const { design } = pet;
  const colorId = design ? design.color : speciesOf(pet).color;
  const color = (PET_COLORS.find((c) => c.id === colorId) ?? PET_COLORS[0]).hex;
  const emoji = stage === 0 ? '🥚' : design ? design.base : speciesOf(pet).looks[stage - 1];
  const traits = design
    ? design.traits.map((id) => PET_TRAITS.find((t) => t.id === id)?.icon ?? '').filter(Boolean)
    : [];
  return { emoji, color, traits, stage };
}

export function hasAbility(xp: number, id: string): boolean {
  const ability = ABILITIES.find((a) => a.id === id);
  return ability !== undefined && stageFor(xp) >= ability.stage;
}

export interface PetUpdate {
  pet: PetState;
  /** The stage newly reached since the learner last saw the pet, or null. */
  evolvedTo: number | null;
  gems: number;
  /** Newly earned accessories. */
  newAccessories: Accessory[];
}

/**
 * Brings the pet up to date with the learner's progress: pays out stages reached since last time
 * (EVOLVE_GEMS × each stage) and grants every accessory whose milestone was reached. A newly earned
 * accessory is put on when its slot is free.
 */
export function growPet(pet: PetState, milestones: Milestones): PetUpdate {
  const m = { ...milestones, groupChallenges: pet.groupChallenges, duelWins: pet.duelWins };
  const stage = stageFor(m.xp);
  let gems = 0;
  for (let s = pet.stageSeen + 1; s <= stage; s++) gems += EVOLVE_GEMS * s;
  const newAccessories = ACCESSORIES.filter((a) => !pet.accessories.includes(a.id) && a.earned(m));
  if (stage <= pet.stageSeen && newAccessories.length === 0) return { pet, evolvedTo: null, gems: 0, newAccessories };
  const worn = { ...pet.worn };
  for (const a of newAccessories) worn[a.slot] ??= a.id;
  return {
    pet: {
      ...pet,
      stageSeen: Math.max(pet.stageSeen, stage),
      accessories: [...pet.accessories, ...newAccessories.map((a) => a.id)],
      worn,
    },
    evolvedTo: stage > pet.stageSeen ? stage : null,
    gems,
    newAccessories,
  };
}

/** Puts on an earned accessory, or takes it off when it is already worn. */
export function toggleAccessory(pet: PetState, id: string): PetState {
  const accessory = accessoryById(id);
  if (!accessory || !pet.accessories.includes(id)) return pet;
  const worn = { ...pet.worn };
  if (worn[accessory.slot] === id) delete worn[accessory.slot];
  else worn[accessory.slot] = id;
  return { ...pet, worn };
}

/** Switches to a premium design (named after it), or back to the species' own look with null. */
export function applyDesign(pet: PetState, design: PetDesign | null): PetState {
  return design ? { ...pet, name: design.name, design } : { ...pet, design: null };
}

/**
 * A completed group challenge was collected: the pet shares the prize and grows with the group
 * (accessories earned by group challenges). Returns what changed, like growPet.
 */
export function recordGroupChallenge(pet: PetState, m: Milestones): PetUpdate {
  return growPet({ ...pet, groupChallenges: pet.groupChallenges + 1 }, m);
}

/** A head-to-head duel was won: the pet counts it (and earns the winner's medal). */
export function recordDuelWin(pet: PetState, m: Milestones): PetUpdate {
  return growPet({ ...pet, duelWins: pet.duelWins + 1 }, m);
}

/** The pet as the learner's groups see it (shared/pet-design.ts PetBadge). */
export function petBadge(pet: PetState, xp: number): PetBadge {
  const look = petLook(pet, xp);
  const worn = look.stage === 0 ? [] : SLOTS.flatMap((slot) => accessoryById(pet.worn[slot] ?? '')?.icon ?? []);
  return { name: pet.name, emoji: look.emoji, stage: look.stage, color: look.color, worn };
}

/** A small, stable hash of a string, for picking today's challenge and lines. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function todaysChallenge(today: string): Challenge {
  return CHALLENGES[hash(today) % CHALLENGES.length];
}

/** The challenge reward: doubled by the legendary aura. */
export function challengeGems(challenge: Challenge, xp: number): number {
  return hasAbility(xp, 'aura') ? challenge.gems * 2 : challenge.gems;
}

/** Today's challenge progress (0 on a new day). */
export function challengeStatus(pet: PetState, today: string): { progress: number; claimed: boolean } {
  if (pet.challengeDate !== today) return { progress: 0, claimed: false };
  return { progress: pet.challengeProgress, claimed: pet.challengeClaimed };
}

export interface PetActivity {
  kind: 'lesson' | 'review' | 'practice';
  flawless: boolean;
  /** Today's XP after the activity. */
  xpToday: number;
}

/**
 * Advances today's challenge with a finished lesson or review. Returns the gems it paid out (0
 * unless this activity completed it). Only pets that have the 'challenge' ability have one.
 */
export function recordChallenge(
  pet: PetState,
  activity: PetActivity,
  totalXp: number,
  today = dateKey(Date.now()),
): { pet: PetState; gems: number; completed: Challenge | null } {
  if (!hasAbility(totalXp, 'challenge')) return { pet, gems: 0, completed: null };
  const challenge = todaysChallenge(today);
  const status = challengeStatus(pet, today);
  if (status.claimed) return { pet, gems: 0, completed: null };
  let progress = status.progress;
  if (challenge.kind === 'xp') progress = activity.xpToday;
  else if (challenge.kind === 'lessons' && activity.kind === 'lesson') progress++;
  else if (challenge.kind === 'flawless' && activity.kind === 'lesson' && activity.flawless) progress++;
  else if (challenge.kind === 'review' && activity.kind !== 'lesson') progress++;
  const done = progress >= challenge.goal;
  const next = {
    ...pet,
    challengeDate: today,
    challengeProgress: Math.min(challenge.goal, progress),
    challengeClaimed: done,
  };
  return done
    ? { pet: next, gems: challengeGems(challenge, totalXp), completed: challenge }
    : { pet: next, gems: 0, completed: null };
}

// --- What the pet says ---------------------------------------------------------------------------------------

type Lines = Record<Personality, string[]>;

const PRAISE: Lines = {
  cheerful: ['יש! איזה שיעור מעולה! 🎉', 'אני כל כך שמחה בשבילכם!', 'עוד שיעור ועוד צעד קדימה. יאללה!'],
  calm: ['עבודה יפה. צעד אחר צעד.', 'ראיתי כמה התאמצתם. כל הכבוד.', 'לאט ובטוח – ככה לומדים באמת.'],
  funny: [
    'וואו! אפילו אני לא ידעתי את זה! 😜',
    'אם הייתי יכולה למחוא כפיים – הייתי עושה את זה עכשיו!',
    'עוד שיעור? בקצב הזה אני אצטרך מילון!',
  ],
  brave: ['ניצחון! ממשיכים קדימה! 💪', 'עוד אתגר מאחורינו. מה הבא?', 'אף שיעור לא עוצר אותנו!'],
};

const FLAWLESS: Lines = {
  cheerful: ['בלי אף טעות?! מושלם! ✨'],
  calm: ['בלי אף טעות. מרשים מאוד.'],
  funny: ['אפס טעויות? אתם בטוח לא רובוט? 🤖'],
  brave: ['שיעור מושלם! אלופים! 🏆'],
};

const GOAL: Lines = {
  cheerful: ['עמדתם ביעד היומי! אני רוקדת משמחה! 💃'],
  calm: ['היעד היומי הושג. אפשר להיות גאים.'],
  funny: ['יעד יומי? בום! סגרנו את זה! 🎯'],
  brave: ['היעד היומי נכבש! 🎯'],
};

const REVIEW: Lines = {
  cheerful: ['חזרה זה הסוד! המילים כבר נדבקות 🧠'],
  calm: ['חזרה טובה. ככה המילים נשארות בזיכרון.'],
  funny: ['המוח שלכם עכשיו גדול יותר. מדעית. כמעט. 🧠'],
  brave: ['חיזקנו את הזיכרון. לא שוכחים כלום!'],
};

const HELLO: Lines = {
  cheerful: ['היי! בא לכם ללמוד משהו חדש היום?', 'כיף שחזרתם! 😊'],
  calm: ['שלום. מוכנים לשיעור קצר?', 'טוב לראות אתכם.'],
  funny: ['אה, הנה אתם! חשבתי שהלכתם לאיבוד 😄', 'ידעתם שינשופים לא יודעים אנגלית? בואו נוכיח שאנחנו כן!'],
  brave: ['מוכנים לאתגר של היום?', 'יאללה, עוד יום של ניצחונות!'],
};

const DONE_TODAY: Lines = {
  cheerful: ['כבר תרגלתם היום. אני גאה בכם! 💖'],
  calm: ['תרגלתם היום. מגיעה לכם מנוחה.'],
  funny: ['תרגלתם היום. עכשיו מותר לאכול עוגה 🍰'],
  brave: ['היום כבר ניצחנו. מחר ממשיכים!'],
};

function pick(lines: string[], seed: number): string {
  return lines[seed % lines.length];
}

export interface Reaction {
  kind: 'lesson' | 'review' | 'practice';
  flawless: boolean;
  goalReached: boolean;
  evolvedTo: number | null;
  newAccessories: Accessory[];
  challenge: Challenge | null;
}

/** The pet's line after a lesson or review; the most notable thing wins. */
export function reactionLine(pet: PetState, r: Reaction, seed = Date.now()): string {
  const personality = personalityOf(pet);
  if (r.evolvedTo !== null) return `התפתחתי! עכשיו אני ${STAGES[r.evolvedTo].name}! תודה שאתם לומדים איתי 🌟`;
  if (r.challenge) return `השלמתם את האתגר שלי: ${r.challenge.title}! ⚡`;
  if (r.newAccessories.length) return `קיבלתי ${r.newAccessories[0].name} ${r.newAccessories[0].icon}! איך אני נראית?`;
  if (r.goalReached) return pick(GOAL[personality], seed);
  if (r.kind !== 'lesson') return pick(REVIEW[personality], seed);
  if (r.flawless) return pick(FLAWLESS[personality], seed);
  return pick(PRAISE[personality], seed);
}

/** The pet's greeting on the path and its own screen. */
export function greetingLine(pet: PetState, practicedToday: boolean, streak: number, seed = Date.now()): string {
  const personality = personalityOf(pet);
  if (practicedToday) return pick(DONE_TODAY[personality], seed);
  if (streak >= 2) return `רצף של ${streak} ימים! בואו לא נשבור אותו היום 🔥`;
  return pick(HELLO[personality], seed);
}

/** The daily reminder, in the pet's voice (`day` varies the wording). */
export function petReminderText(
  pet: { name: string; emoji: string },
  streak: number,
  day: number,
): { title: string; body: string } {
  if (streak > 0) {
    const days = streak === 1 ? 'יום אחד' : `${streak} ימים`;
    return { title: `${pet.emoji} ${pet.name} שומרת על הרצף: ${days}`, body: 'כמה דקות של אנגלית היום, וממשיכים יחד!' };
  }
  const bodies = ['מתגעגעת אליכם! שיעור קצר באנגלית? 📚', 'חמש דקות ביום ואני גדלה. נתרגל?', 'הכנתי לכם אתגר. בואו!'];
  return { title: `${pet.emoji} ${pet.name}`, body: bodies[day % bodies.length] };
}

/** The text for sharing the pet with friends. */
export function shareText(pet: PetState, xp: number, streak: number): string {
  const look = petLook(pet, xp);
  const kind = pet.design ? 'החיה שעיצבתי' : `ה${speciesOf(pet).name} שלי`;
  const streakText = streak > 0 ? `, רצף של ${streak} ימים` : '';
  return `${look.emoji} הכירו את ${pet.name}, ${kind} ב־Baktana English! שלב: ${STAGES[look.stage].name} (${xp} XP${streakText}). בואו ללמוד אנגלית איתנו!`;
}

function load(): PetState | null {
  try {
    return parsePet(localStorage.getItem(PET_KEY));
  } catch {
    return null;
  }
}

/** The pet, persisted in localStorage (null before adoption). */
export function usePet() {
  const [pet, setPet] = useState<PetState | null>(load);

  useEffect(() => {
    try {
      if (pet) localStorage.setItem(PET_KEY, JSON.stringify(pet));
      else localStorage.removeItem(PET_KEY);
    } catch {
      // Ignore – the pet just won't persist.
    }
  }, [pet]);

  const update = useCallback((fn: (p: PetState | null) => PetState | null) => setPet(fn), []);
  const reset = useCallback(() => setPet(null), []);
  return { pet, update, reset };
}
