/**
 * Analytics event contract: the canonical event names, the event row sent to the backends
 * and the limits both sides enforce. Spec: docs/spec/v2.md §8.
 * No personal data: never an email, name, IP address or typed answer.
 * Contract file – owned by the backend agent, changes are additive only.
 */
import type { ExerciseType } from '../src/types';

export const ANALYTICS_EVENT_NAMES = [
  'app_open',
  'onboarding_complete',
  'lesson_start',
  'exercise_answer',
  'lesson_complete',
  'lesson_abandon',
  'hearts_out',
  'review_start',
  'review_complete',
  'unit_intro_shown',
  'signup_prompt_shown',
  'signup_prompt_accepted',
  'signup_prompt_dismissed',
  'signup_complete',
  'identify',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type Platform = 'web' | 'pwa' | 'android';

export type PropValue = string | number | boolean | null | string[];

/** What the app passes to track(). The analytics module adds the context fields. */
export interface AnalyticsEventInput {
  name: AnalyticsEventName;
  /** Lesson id (`u3l1`); null for a review session. */
  lessonId?: string | null;
  /** exercise_answer only. */
  itemKey?: string;
  exType?: ExerciseType;
  correct?: boolean;
  firstTry?: boolean;
  /** Duration of a lesson/review (lesson_complete, review_complete). 0 … 3_600_000. */
  durationMs?: number;
  /** Small event-specific extras (docs/spec/v2.md §8.2). Serialized size < MAX_PROPS_BYTES. */
  props?: Record<string, PropValue>;
}

/** A queued/sent event: the input plus anonymous context. */
export interface AnalyticsEvent extends AnalyticsEventInput {
  /** Random UUID kept in localStorage (`baktana-english:anon-id:v1`). */
  anonId: string;
  /** Client ms timestamp. */
  ts: number;
  /** Learner's local date YYYY-MM-DD and hour 0–23. */
  localDate: string;
  localHour: number;
  appVersion: string;
  platform: Platform;
}

/** POST /api/events (optional auth) – responds 204 No Content. */
export interface EventsRequest {
  events: AnalyticsEvent[];
}

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_QUEUED_EVENTS = 500;
export const MAX_PROPS_BYTES = 1024;
export const MAX_DURATION_MS = 3_600_000;

const EXERCISE_TYPES: readonly ExerciseType[] = ['choice-en', 'choice-he', 'match', 'build-en', 'build-he', 'listen'];
const PLATFORMS: readonly Platform[] = ['web', 'pwa', 'android'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Column limits shared with supabase/schema.sql (`events`). */
export const MAX_LESSON_ID_LENGTH = 12;
export const MAX_ITEM_KEY_CHARS = 80;
export const MAX_APP_VERSION_LENGTH = 20;
/** Client timestamps more than this far ahead of the server clock are rejected. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

const isName = (v: unknown): v is AnalyticsEventName =>
  typeof v === 'string' && (ANALYTICS_EVENT_NAMES as readonly string[]).includes(v);

function isRealDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v;
}

const isPropValue = (v: unknown): v is PropValue =>
  v === null ||
  typeof v === 'string' ||
  typeof v === 'boolean' ||
  (typeof v === 'number' && Number.isFinite(v)) ||
  (Array.isArray(v) && v.every((x) => typeof x === 'string'));

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function sanitizeProps(v: unknown): Record<string, PropValue> | null {
  if (v === undefined || v === null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) return null;
  const entries = Object.entries(v);
  if (!entries.every(([, value]) => isPropValue(value))) return null;
  const props = Object.fromEntries(entries) as Record<string, PropValue>;
  return byteLength(JSON.stringify(props)) < MAX_PROPS_BYTES ? props : null;
}

/** One event, or null when any field is invalid (the backends store it as a whole or not at all). */
function sanitizeEvent(input: unknown, now: number): AnalyticsEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const e = input as Record<string, unknown>;
  if (!isName(e.name)) return null;
  if (typeof e.anonId !== 'string' || !UUID_RE.test(e.anonId)) return null;
  if (typeof e.ts !== 'number' || !Number.isFinite(e.ts) || e.ts <= 0 || e.ts > now + MAX_CLOCK_SKEW_MS) return null;
  if (!isRealDate(e.localDate)) return null;
  if (typeof e.localHour !== 'number' || !Number.isInteger(e.localHour) || e.localHour < 0 || e.localHour > 23) {
    return null;
  }
  if (typeof e.appVersion !== 'string' || e.appVersion.length > MAX_APP_VERSION_LENGTH) return null;
  if (!PLATFORMS.includes(e.platform as Platform)) return null;
  const props = sanitizeProps(e.props);
  if (!props) return null;
  const event: AnalyticsEvent = {
    name: e.name,
    anonId: e.anonId.toLowerCase(),
    ts: Math.round(e.ts),
    localDate: e.localDate,
    localHour: e.localHour,
    appVersion: e.appVersion,
    platform: e.platform as Platform,
    props,
  };
  if (e.lessonId !== undefined && e.lessonId !== null) {
    if (typeof e.lessonId !== 'string' || e.lessonId.length > MAX_LESSON_ID_LENGTH) return null;
    event.lessonId = e.lessonId;
  } else if (e.lessonId === null) {
    event.lessonId = null;
  }
  if (e.itemKey !== undefined && e.itemKey !== null) {
    if (typeof e.itemKey !== 'string' || e.itemKey.length > MAX_ITEM_KEY_CHARS) return null;
    event.itemKey = e.itemKey;
  }
  if (e.exType !== undefined && e.exType !== null) {
    if (!EXERCISE_TYPES.includes(e.exType as ExerciseType)) return null;
    event.exType = e.exType as ExerciseType;
  }
  for (const flag of ['correct', 'firstTry'] as const) {
    const value = e[flag];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'boolean') return null;
    event[flag] = value;
  }
  if (e.durationMs !== undefined && e.durationMs !== null) {
    const d = e.durationMs;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > MAX_DURATION_MS) return null;
    event.durationMs = Math.round(d);
  }
  return event;
}

/**
 * Validates an untrusted batch (Express POST /api/events): drops events with an unknown
 * name, a non-UUID anonId, bad dates/hours or oversized props; at most MAX_EVENTS_PER_BATCH
 * (the first ones are kept). Returns [] when `input` is not an array.
 * The checks mirror the column constraints of `events` in supabase/schema.sql.
 */
export function sanitizeEvents(input: unknown, now = Date.now()): AnalyticsEvent[] {
  if (!Array.isArray(input)) return [];
  const out: AnalyticsEvent[] = [];
  for (const raw of input.slice(0, MAX_EVENTS_PER_BATCH)) {
    const event = sanitizeEvent(raw, now);
    if (event) out.push(event);
  }
  return out;
}
