/**
 * Client analytics: anonymous id, offline queue in localStorage, batched flush to
 * Supabase (`public.events`) or the Express server (POST /api/events), opt-out.
 * Spec: docs/spec/v2.md §8. Owned by the BI agent. KPI and view docs: docs/bi/.
 *
 * Privacy: events carry only an anonymous random id, the app version, the platform and the
 * learner's local date/hour – never an email, a name, an IP address or a typed answer.
 * `user_id` is never sent; the backend sets it from the session (Supabase) or the token (Express).
 *
 * track() never throws and never blocks the UI. Losing events is acceptable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import {
  ANALYTICS_EVENT_NAMES,
  MAX_DURATION_MS,
  MAX_EVENTS_PER_BATCH,
  MAX_PROPS_BYTES,
  MAX_QUEUED_EVENTS,
  type AnalyticsEvent,
  type AnalyticsEventInput,
  type Platform,
  type PropValue,
} from '../../shared/analytics';
import { loadAuth } from './api';
import { ACCOUNTS_ENABLED, USE_SUPABASE } from './config';

export const ANON_ID_KEY = 'baktana-english:anon-id:v1';
export const EVENT_QUEUE_KEY = 'baktana-english:events:v1';
export const APP_VERSION = '0.2.0';

/** The settings key owned by the UI (Settings.analytics, docs/spec/v2.md §7.7) – read only here. */
const SETTINGS_KEY = 'baktana-english:settings:v1';
/** Flush as soon as this many events are waiting. */
export const FLUSH_THRESHOLD = 10;
/** Periodic flush while the app is open. */
export const FLUSH_INTERVAL_MS = 60_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_NAMES = new Set<string>(ANALYTICS_EVENT_NAMES);

/** A queued event: the sent event plus a local sequence number (never sent). */
interface QueuedEvent extends AnalyticsEvent {
  q: number;
}

/** One row of `public.events` as inserted by the client (docs/spec/v2.md §6.6). No `user_id`. */
export interface EventRow {
  anon_id: string;
  name: string;
  lesson_id: string | null;
  item_key: string | null;
  ex_type: string | null;
  correct: boolean | null;
  first_try: boolean | null;
  duration_ms: number | null;
  props: Record<string, PropValue>;
  client_ts: string;
  local_date: string;
  local_hour: number;
  app_version: string;
  platform: Platform;
}

/** Maps a queued event to the snake_case columns of `public.events` (§6.6 mapping table). */
export function toEventRow(e: AnalyticsEvent): EventRow {
  return {
    anon_id: e.anonId,
    name: e.name,
    lesson_id: e.lessonId ?? null,
    item_key: e.itemKey ?? null,
    ex_type: e.exType ?? null,
    correct: e.correct ?? null,
    first_try: e.firstTry ?? null,
    duration_ms: e.durationMs ?? null,
    props: e.props ?? {},
    client_ts: new Date(e.ts).toISOString(),
    local_date: e.localDate,
    local_hour: e.localHour,
    app_version: e.appVersion,
    platform: e.platform,
  };
}

/** The learner's local calendar date (YYYY-MM-DD) and hour. */
export function localContext(ts: number): { localDate: string; localHour: number } {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { localDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, localHour: d.getHours() };
}

/** A random RFC 4122 v4 UUID (crypto.randomUUID when available). */
export function randomUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Keeps only fields the contract allows, clamped to the limits the backends enforce. */
function cleanInput(input: AnalyticsEventInput): AnalyticsEventInput | null {
  if (!input || !EVENT_NAMES.has(input.name)) return null;
  const out: AnalyticsEventInput = { name: input.name };
  if (typeof input.lessonId === 'string' && input.lessonId.length <= 12) out.lessonId = input.lessonId;
  else if (input.lessonId === null) out.lessonId = null;
  if (typeof input.itemKey === 'string' && input.itemKey.length <= 80) out.itemKey = input.itemKey;
  if (typeof input.exType === 'string') out.exType = input.exType;
  if (typeof input.correct === 'boolean') out.correct = input.correct;
  if (typeof input.firstTry === 'boolean') out.firstTry = input.firstTry;
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)) {
    out.durationMs = Math.min(MAX_DURATION_MS, Math.max(0, Math.round(input.durationMs)));
  }
  if (input.props && typeof input.props === 'object') {
    const props: Record<string, PropValue> = {};
    for (const [k, v] of Object.entries(input.props)) {
      const ok =
        v === null ||
        typeof v === 'boolean' ||
        (typeof v === 'number' && Number.isFinite(v)) ||
        typeof v === 'string' ||
        (Array.isArray(v) && v.every((x) => typeof x === 'string'));
      if (ok) props[k] = v;
    }
    // Oversized props would be rejected by the backend check and poison the whole batch.
    if (new TextEncoder().encode(JSON.stringify(props)).length < MAX_PROPS_BYTES) out.props = props;
  }
  return out;
}

/** Minimal Storage subset (localStorage, or an in-memory stand-in in tests). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type AnalyticsBackend = 'supabase' | 'api' | 'none';

export interface AnalyticsOptions {
  /** Where events go. Default: Supabase when configured, else the Express API when accounts are on. */
  backend: AnalyticsBackend;
  /** Returns the storage, or throws when it is unavailable (private mode, quota). */
  storage: () => KeyValueStorage;
  getSupabase: () => Promise<Pick<SupabaseClient, 'from'>>;
  fetch: typeof fetch;
  /** Bearer token for the Express server, if signed in. */
  authToken: () => string | undefined;
  platform: () => Platform;
  isOnline: () => boolean;
  now: () => number;
  /** Starting opt-in state; setAnalyticsEnabled() changes it at runtime. */
  enabled: boolean;
}

/** Result of sending one batch: sent, dropped as invalid (never retried) or retry later. */
type SendResult = 'ok' | 'drop' | 'retry';

/** HTTP statuses that mean "this batch is invalid" – retrying it would block the queue forever. */
function isPermanentRejection(status: number): boolean {
  return status >= 400 && status < 500 && ![401, 403, 408, 425, 429].includes(status);
}

export interface Analytics {
  track(event: AnalyticsEventInput): void;
  flush(): Promise<void>;
  setAnalyticsEnabled(enabled: boolean): void;
  identify(): void;
  anonId(): string;
  isEnabled(): boolean;
  /** The queued events, oldest first (for tests and debugging). */
  queued(): AnalyticsEvent[];
}

/** Builds an analytics client. The app uses the default instance below; tests inject fakes. */
export function createAnalytics(opts: AnalyticsOptions): Analytics {
  let enabled = opts.enabled;
  let memoryId: string | undefined;
  let memoryQueue: QueuedEvent[] = [];
  let inFlight: Promise<void> | undefined;
  let rerun: Promise<void> | undefined;

  function readQueue(): QueuedEvent[] {
    try {
      const raw = opts.storage().getItem(EVENT_QUEUE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw) as unknown;
      return Array.isArray(data)
        ? (data as QueuedEvent[]).filter((e) => e && typeof e === 'object' && EVENT_NAMES.has(e.name))
        : [];
    } catch {
      return memoryQueue;
    }
  }

  function writeQueue(queue: QueuedEvent[]) {
    const trimmed = queue.length > MAX_QUEUED_EVENTS ? queue.slice(queue.length - MAX_QUEUED_EVENTS) : queue;
    memoryQueue = trimmed;
    try {
      if (trimmed.length === 0) opts.storage().removeItem(EVENT_QUEUE_KEY);
      else opts.storage().setItem(EVENT_QUEUE_KEY, JSON.stringify(trimmed));
    } catch {
      // Storage full or blocked: the in-memory queue still works for this session.
    }
  }

  function anonId(): string {
    try {
      const store = opts.storage();
      const saved = store.getItem(ANON_ID_KEY);
      if (saved && UUID_RE.test(saved)) return saved;
      const id = memoryId ?? randomUuid();
      store.setItem(ANON_ID_KEY, id);
      memoryId = id;
      return id;
    } catch {
      memoryId ??= randomUuid();
      return memoryId;
    }
  }

  async function send(batch: AnalyticsEvent[]): Promise<SendResult> {
    if (opts.backend === 'supabase') {
      const client = await opts.getSupabase();
      const { error, status } = await client.from('events').insert(batch.map(toEventRow));
      if (!error) return 'ok';
      return isPermanentRejection(status) ? 'drop' : 'retry';
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = opts.authToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await opts.fetch('/api/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
    });
    if (res.ok) return 'ok';
    return isPermanentRejection(res.status) ? 'drop' : 'retry';
  }

  async function drain(): Promise<void> {
    if (opts.backend === 'none' || !opts.isOnline()) return;
    // Bounded loop: at most one pass over a full queue.
    for (let round = 0; round <= MAX_QUEUED_EVENTS / MAX_EVENTS_PER_BATCH; round++) {
      if (!enabled) return;
      const queued = readQueue();
      if (queued.length === 0) return;
      const batch = queued.slice(0, MAX_EVENTS_PER_BATCH);
      let result: SendResult;
      try {
        result = await send(batch.map(({ q: _q, ...event }) => event));
      } catch {
        result = 'retry'; // offline, timeout, server down
      }
      if (result === 'retry') return;
      // Remove exactly the events that were sent: more may have been queued meanwhile.
      const sent = new Set(batch.map((e) => e.q));
      writeQueue(readQueue().filter((e) => !sent.has(e.q)));
    }
  }

  function flush(): Promise<void> {
    // One drain at a time; a flush requested meanwhile runs once more after it.
    if (inFlight) {
      rerun ??= inFlight.then(() => {
        rerun = undefined;
        return flush();
      });
      return rerun;
    }
    inFlight = drain()
      .catch(() => undefined)
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }

  function track(input: AnalyticsEventInput): void {
    try {
      if (!enabled) return;
      const clean = cleanInput(input);
      if (!clean) return;
      const ts = opts.now();
      const queue = readQueue();
      const q = queue.reduce((max, e) => Math.max(max, typeof e.q === 'number' ? e.q : 0), 0) + 1;
      const event: QueuedEvent = {
        ...clean,
        anonId: anonId(),
        ts,
        ...localContext(ts),
        appVersion: APP_VERSION,
        platform: opts.platform(),
        q,
      };
      queue.push(event);
      writeQueue(queue);
      if (queue.length >= FLUSH_THRESHOLD) void flush();
    } catch {
      // Never let analytics break the app.
    }
  }

  function setAnalyticsEnabled(next: boolean): void {
    enabled = next;
    if (!next) writeQueue([]);
  }

  function identify(): void {
    if (!enabled) return;
    track({ name: 'identify' });
    void flush();
  }

  return {
    track,
    flush,
    setAnalyticsEnabled,
    identify,
    anonId,
    isEnabled: () => enabled,
    queued: () => readQueue().map(({ q: _q, ...event }) => event),
  };
}

function detectPlatform(): Platform {
  try {
    if (Capacitor.isNativePlatform()) return 'android';
  } catch {
    // Capacitor unavailable: fall through to the web checks.
  }
  try {
    if (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) return 'pwa';
  } catch {
    // ignore
  }
  return 'web';
}

/** Settings.analytics from the UI's settings key; missing or unreadable → on (the default). */
function savedOptIn(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    return (JSON.parse(raw) as { analytics?: unknown }).analytics !== false;
  } catch {
    return true;
  }
}

const hasWindow = typeof window !== 'undefined';

const client = createAnalytics({
  backend: USE_SUPABASE ? 'supabase' : ACCOUNTS_ENABLED ? 'api' : 'none',
  storage: () => localStorage,
  getSupabase: () => import('./supabase').then((m) => m.getSupabase()),
  fetch: (...args) => fetch(...args),
  authToken: () => loadAuth()?.token,
  platform: detectPlatform,
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  now: () => Date.now(),
  enabled: savedOptIn(),
});

let started = false;

/** Flush on start-up, when the network returns, when the app is hidden and every minute. */
function start() {
  if (started || !hasWindow) return;
  started = true;
  try {
    window.addEventListener('online', () => void client.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void client.flush();
    });
    setInterval(() => void client.flush(), FLUSH_INTERVAL_MS);
    setTimeout(() => void client.flush(), 0);
  } catch {
    // Non-browser environment.
  }
}

/** Queues one event (dropped silently when analytics are disabled). */
export function track(event: AnalyticsEventInput): void {
  start();
  client.track(event);
}

/** Sends queued events in batches if online and a backend is configured. */
export async function flush(): Promise<void> {
  await client.flush();
}

/** Turned off by the Profile toggle (Settings.analytics); clears the queue when turned off. */
export function setAnalyticsEnabled(enabled: boolean): void {
  client.setAnalyticsEnabled(enabled);
  if (enabled) start();
}

/** Sends the `identify` event linking the anonymous id to the signed-in account. */
export function identify(): void {
  start();
  client.identify();
}

/** The anonymous id (created on first use). */
export function anonId(): string {
  return client.anonId();
}
