/**
 * Premium custom pets (src/lib/pet.ts): the building blocks a learner designs a unique pet from, and the
 * contract for designing one with AI. POST /api/pet/design on the Express server, or the `pet-design`
 * Supabase Edge Function: body PetDesignRequest → 200 PetDesignResponse.
 * Pure TypeScript with no imports, so the browser, Node and Deno all use it as is.
 */

export type Personality = 'cheerful' | 'calm' | 'funny' | 'brave';

export interface PersonalityInfo {
  id: Personality;
  label: string;
  description: string;
}

export const PERSONALITIES: PersonalityInfo[] = [
  { id: 'cheerful', label: 'שמחה', description: 'אופטימית ומלאת אנרגיה' },
  { id: 'calm', label: 'רגועה', description: 'סבלנית, חכמה ומרגיעה' },
  { id: 'funny', label: 'מצחיקה', description: 'אוהבת בדיחות ושטויות' },
  { id: 'brave', label: 'אמיצה', description: 'אוהבת אתגרים ולא מוותרת' },
];

/** The animals a custom pet can be based on. */
export const PET_BASES = [
  '🐶',
  '🐱',
  '🦊',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐸',
  '🐵',
  '🐰',
  '🐻',
  '🐧',
  '🦉',
  '🐢',
  '🐙',
  '🦄',
  '🐲',
  '🦖',
  '🐬',
  '🦋',
] as const;

export interface PetColor {
  id: string;
  label: string;
  hex: string;
}

export const PET_COLORS: PetColor[] = [
  { id: 'sky', label: 'תכלת', hex: '#5ab8ff' },
  { id: 'mint', label: 'מנטה', hex: '#3fd1a8' },
  { id: 'sun', label: 'שמש', hex: '#ffc21a' },
  { id: 'coral', label: 'אלמוג', hex: '#ff7a6b' },
  { id: 'berry', label: 'פטל', hex: '#e2559b' },
  { id: 'lilac', label: 'לילך', hex: '#b48cff' },
  { id: 'forest', label: 'יער', hex: '#4caf50' },
  { id: 'night', label: 'לילה', hex: '#3d5afe' },
];

export interface PetTrait {
  id: string;
  icon: string;
  label: string;
}

/** Special features shown around the pet; a design has up to MAX_TRAITS of them. */
export const PET_TRAITS: PetTrait[] = [
  { id: 'sparkles', icon: '✨', label: 'נצנצים' },
  { id: 'fire', icon: '🔥', label: 'נשימת אש' },
  { id: 'lightning', icon: '⚡', label: 'ברק' },
  { id: 'rainbow', icon: '🌈', label: 'קשת' },
  { id: 'snow', icon: '❄️', label: 'קרח' },
  { id: 'flowers', icon: '🌸', label: 'פרחים' },
  { id: 'stars', icon: '⭐', label: 'כוכבים' },
  { id: 'music', icon: '🎵', label: 'מוזיקה' },
  { id: 'bubbles', icon: '🫧', label: 'בועות' },
  { id: 'hearts', icon: '💖', label: 'לבבות' },
];

export const MAX_TRAITS = 3;
export const MAX_PET_NAME = 16;
export const MAX_PET_BIO = 140;
export const MAX_DESIGN_PROMPT = 300;
/** AI designs per learner per day. */
export const PET_DESIGNS_PER_DAY = 10;

export interface PetDesign {
  name: string;
  /** One of PET_BASES. */
  base: string;
  /** A PET_COLORS id. */
  color: string;
  /** PET_TRAITS ids, at most MAX_TRAITS. */
  traits: string[];
  personality: Personality;
  /** A short Hebrew description of the pet. */
  bio: string;
}

export interface PetDesignRequest {
  /** What the learner wants, in their own words (Hebrew or English). */
  prompt: string;
  /** The design so far, to refine instead of starting over. */
  current?: PetDesign;
}

export type PetDesignResponse = PetDesign;

const PERSONALITY_IDS = PERSONALITIES.map((p) => p.id);
const COLOR_IDS = PET_COLORS.map((c) => c.id);
const TRAIT_IDS = PET_TRAITS.map((t) => t.id);

/** Trims, collapses whitespace and drops control characters. */
function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return (
    v
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  );
}

/** A valid design built from untrusted data (model output, storage), or null when it can't be. */
export function parsePetDesign(data: unknown): PetDesign | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const name = cleanText(d.name, MAX_PET_NAME);
  if (!name) return null;
  const base = (PET_BASES as readonly string[]).includes(d.base as string) ? (d.base as string) : PET_BASES[0];
  const color = COLOR_IDS.includes(d.color as string) ? (d.color as string) : COLOR_IDS[0];
  const traits = Array.isArray(d.traits)
    ? [...new Set(d.traits.filter((t): t is string => TRAIT_IDS.includes(t as string)))].slice(0, MAX_TRAITS)
    : [];
  const personality = PERSONALITY_IDS.includes(d.personality as Personality)
    ? (d.personality as Personality)
    : 'cheerful';
  return { name, base, color, traits, personality, bio: cleanText(d.bio, MAX_PET_BIO) };
}

/** The request with its prompt trimmed and capped, or null without a usable prompt. */
export function sanitizeDesignRequest(body: unknown): PetDesignRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const prompt = cleanText(b.prompt, MAX_DESIGN_PROMPT);
  if (!prompt) return null;
  const current = b.current === undefined ? null : parsePetDesign(b.current);
  return current ? { prompt, current } : { prompt };
}

/** Structured output: the model must answer with exactly this shape (parsePetDesign still validates it). */
export const PET_DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    base: { type: 'string', enum: [...PET_BASES] },
    color: { type: 'string', enum: COLOR_IDS },
    traits: { type: 'array', items: { type: 'string', enum: TRAIT_IDS } },
    personality: { type: 'string', enum: PERSONALITY_IDS },
    bio: { type: 'string' },
  },
  required: ['name', 'base', 'color', 'traits', 'personality', 'bio'],
  additionalProperties: false,
} as const;

export function buildDesignSystemPrompt(): string {
  const list = (items: { id: string; label: string }[]) => items.map((i) => `${i.id} (${i.label})`).join(', ');
  return [
    'You design a cute companion pet for a learner in a Hebrew-language app that teaches English to children and adults.',
    'The pet does not teach; it cheers the learner on. Turn the learner’s wish into a pet design.',
    `base: the animal emoji closest to the wish, one of: ${PET_BASES.join(' ')}.`,
    `color: one of ${list(PET_COLORS)}.`,
    `traits: up to ${MAX_TRAITS} special features from ${list(PET_TRAITS)}.`,
    `personality: one of ${list(PERSONALITIES)}.`,
    `name: a short, friendly pet name in Hebrew (at most ${MAX_PET_NAME} characters), unless the learner chose one.`,
    `bio: one or two warm sentences in Hebrew about the pet (at most ${MAX_PET_BIO} characters), gender-neutral where possible.`,
    'Keep everything suitable for children. If the wish is inappropriate, design a friendly default pet instead.',
    'When a current design is given, change only what the learner asks for and keep the rest.',
  ].join('\n');
}

export function buildDesignUserMessage(req: PetDesignRequest): string {
  const current = req.current ? `Current design: ${JSON.stringify(req.current)}\n` : '';
  return `${current}The learner's wish: ${req.prompt}`;
}

// --- The pet as other learners see it (group boards) ---------------------------------------------------------

/** Every look a pet can have: the egg, the species' stages (src/lib/pet.ts SPECIES) and the premium bases. */
export const PET_EMOJIS: readonly string[] = [
  ...new Set(['🥚', '🦎', '🐲', '🐉', '🐣', '🐥', '🦉', '🐱', '🐯', '🐅', '🐴', '🦄', ...PET_BASES]),
];

/** Every accessory icon (src/lib/pet.ts ACCESSORIES). */
export const PET_ACCESSORY_ICONS: readonly string[] = [
  '🧣',
  '🧢',
  '🎀',
  '🎧',
  '🕶️',
  '🎓',
  '🏅',
  '🎩',
  '👑',
  '🎗️',
  '🎖️',
  '🥇',
];

/** The last stage (src/lib/pet.ts STAGES). */
export const MAX_PET_STAGE = 4;

/**
 * The pet as shown to the learner's groups: PUT /api/me/pet (or the Supabase profile) stores it,
 * and GroupMember.pet carries it to the other members.
 */
export interface PetBadge {
  name: string;
  /** One of PET_EMOJIS. */
  emoji: string;
  /** 0 (egg) to MAX_PET_STAGE. */
  stage: number;
  /** A PET_COLORS hex. */
  color: string;
  /** Worn accessories (PET_ACCESSORY_ICONS), at most three. */
  worn: string[];
}

/** PUT /api/me/pet (auth) – shares the learner's pet with their groups; null stops sharing. 204. */
export interface SetPetRequest {
  pet: PetBadge | null;
}

/** A valid badge from untrusted data (a request, a database row), or null. */
export function parsePetBadge(data: unknown): PetBadge | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const name = cleanText(d.name, MAX_PET_NAME);
  const stage = d.stage;
  if (!name || typeof d.emoji !== 'string' || !PET_EMOJIS.includes(d.emoji)) return null;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 0 || stage > MAX_PET_STAGE) return null;
  const color = PET_COLORS.some((c) => c.hex === d.color) ? (d.color as string) : PET_COLORS[0].hex;
  const worn = Array.isArray(d.worn)
    ? [...new Set(d.worn.filter((w): w is string => PET_ACCESSORY_ICONS.includes(w as string)))].slice(0, 3)
    : [];
  return { name, emoji: d.emoji, stage, color, worn };
}
