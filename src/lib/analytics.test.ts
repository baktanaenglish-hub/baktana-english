import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsEvent } from '../../shared/analytics';
import {
  ANON_ID_KEY,
  APP_VERSION,
  EVENT_QUEUE_KEY,
  createAnalytics,
  localContext,
  randomUuid,
  toEventRow,
  type AnalyticsOptions,
  type KeyValueStorage,
} from './analytics';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Minimal in-memory localStorage for the node test environment. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

/** Fake supabase-js: records inserted rows; `fail` makes the next inserts fail with a status. */
function fakeSupabase() {
  const inserts: { table: string; rows: unknown[] }[] = [];
  const state = { failStatus: 0 };
  const client = {
    from: (table: string) => ({
      insert: async (rows: unknown[]) => {
        if (state.failStatus) return { error: { message: 'nope' }, status: state.failStatus };
        inserts.push({ table, rows });
        return { error: null, status: 201 };
      },
    }),
  };
  return { inserts, state, getSupabase: async () => client as never };
}

function setup(overrides: Partial<AnalyticsOptions> = {}) {
  const storage = memoryStorage();
  const supabase = fakeSupabase();
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  let online = true;
  let now = Date.UTC(2026, 9, 18, 9, 30);
  const analytics = createAnalytics({
    backend: 'supabase',
    storage: () => storage,
    getSupabase: supabase.getSupabase,
    fetch: fetchMock as unknown as typeof fetch,
    authToken: () => undefined,
    platform: () => 'web',
    isOnline: () => online,
    now: () => now++,
    enabled: true,
    ...overrides,
  });
  return {
    analytics,
    storage,
    supabase,
    fetchMock,
    setOnline: (v: boolean) => (online = v),
  };
}

/** Simulates one full lesson (US-T1 AC1): start, one answer per exercise, complete. */
function playLesson(track: ReturnType<typeof setup>['analytics']['track'], exercises = 12) {
  track({ name: 'lesson_start', lessonId: 'u1l1', props: { catchup: false, attempt: 1 } });
  for (let i = 0; i < exercises; i++) {
    track({
      name: 'exercise_answer',
      lessonId: 'u1l1',
      itemKey: `w:word${i}`,
      exType: 'choice-en',
      correct: i % 4 !== 0,
      firstTry: true,
      props: { errors: ['E1'] },
    });
  }
  track({
    name: 'lesson_complete',
    lessonId: 'u1l1',
    durationMs: 95_000,
    props: { accuracy: 0.75, mistakes: 3, xp: 10, heartsLeft: 2 },
  });
}

describe('analytics: queue and context', () => {
  it('queues a full lesson in order with anonymous context (US-T1 AC1, AC2)', () => {
    const { analytics } = setup({ backend: 'none' });
    playLesson(analytics.track);
    const q = analytics.queued();
    expect(q.map((e) => e.name)).toEqual(['lesson_start', ...Array(12).fill('exercise_answer'), 'lesson_complete']);
    for (const e of q) {
      expect(e.anonId).toMatch(UUID_RE);
      expect(e.appVersion).toBe(APP_VERSION);
      expect(e.platform).toBe('web');
      expect(e.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.localHour).toBeGreaterThanOrEqual(0);
      expect(e.localHour).toBeLessThanOrEqual(23);
      // No internal fields and no personal data keys leak into the event.
      expect(Object.keys(e)).not.toContain('q');
      for (const key of ['email', 'name_', 'displayName', 'ip', 'answer', 'user_id', 'userId']) {
        expect(Object.keys(e)).not.toContain(key);
      }
    }
  });

  it('keeps the anonymous id stable across restarts (US-T1 AC2)', () => {
    const storage = memoryStorage();
    const first = setup({ storage: () => storage, backend: 'none' }).analytics.anonId();
    const second = setup({ storage: () => storage, backend: 'none' }).analytics.anonId();
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
    expect(storage.getItem(ANON_ID_KEY)).toBe(first);
  });

  it('replaces a corrupted anonymous id with a fresh UUID', () => {
    const storage = memoryStorage();
    storage.setItem(ANON_ID_KEY, 'dana@example.com');
    const id = setup({ storage: () => storage }).analytics.anonId();
    expect(id).toMatch(UUID_RE);
  });

  it('caps the queue at 500, dropping the oldest events (US-T1 AC3)', () => {
    const { analytics, storage } = setup({ backend: 'none' });
    for (let i = 0; i < 520; i++) analytics.track({ name: 'hearts_out', lessonId: 'u1l1', props: { i } });
    const q = analytics.queued();
    expect(q).toHaveLength(500);
    expect(q[0].props).toEqual({ i: 20 });
    expect(q[499].props).toEqual({ i: 519 });
    expect(JSON.parse(storage.getItem(EVENT_QUEUE_KEY) ?? '[]')).toHaveLength(500);
  });

  it('drops unknown event names, oversized props and non-primitive prop values', () => {
    const { analytics } = setup({ backend: 'none' });
    analytics.track({ name: 'password_typed' as never });
    analytics.track({ name: 'app_open', props: { blob: 'x'.repeat(2000) } });
    analytics.track({
      name: 'onboarding_complete',
      props: { dailyGoal: 20, nested: { a: 1 } as never, list: ['E1', 'E2'] },
    });
    const q = analytics.queued();
    expect(q.map((e) => e.name)).toEqual(['app_open', 'onboarding_complete']);
    expect(q[0].props).toBeUndefined();
    expect(q[1].props).toEqual({ dailyGoal: 20, list: ['E1', 'E2'] });
  });

  it('clamps durations to 0…3_600_000 ms', () => {
    const { analytics } = setup({ backend: 'none' });
    analytics.track({ name: 'lesson_complete', lessonId: 'u1l1', durationMs: 9_999_999 });
    analytics.track({ name: 'review_complete', durationMs: -5 });
    expect(analytics.queued().map((e) => e.durationMs)).toEqual([3_600_000, 0]);
  });

  it('never throws, even when storage is unavailable', () => {
    const { analytics } = setup({
      backend: 'none',
      storage: () => {
        throw new Error('SecurityError');
      },
    });
    expect(() => analytics.track({ name: 'app_open' })).not.toThrow();
    expect(analytics.queued()).toHaveLength(1);
    expect(analytics.anonId()).toMatch(UUID_RE);
  });
});

describe('analytics: opt-out (US-T1 AC4)', () => {
  it('clears the queue when turned off and records nothing until turned back on', () => {
    const { analytics, storage } = setup({ backend: 'none' });
    analytics.track({ name: 'app_open' });
    analytics.setAnalyticsEnabled(false);
    expect(analytics.queued()).toHaveLength(0);
    expect(storage.getItem(EVENT_QUEUE_KEY)).toBeNull();
    analytics.track({ name: 'lesson_start', lessonId: 'u1l1' });
    analytics.identify();
    expect(analytics.queued()).toHaveLength(0);
    analytics.setAnalyticsEnabled(true);
    analytics.track({ name: 'lesson_start', lessonId: 'u1l1' });
    expect(analytics.queued()).toHaveLength(1);
  });

  it('starts disabled when the saved setting says so', () => {
    const { analytics } = setup({ enabled: false });
    analytics.track({ name: 'app_open' });
    expect(analytics.queued()).toHaveLength(0);
    expect(analytics.isEnabled()).toBe(false);
  });
});

describe('analytics: snake_case mapping (§6.6)', () => {
  it('maps every field to its column and never sends user_id', () => {
    const event: AnalyticsEvent = {
      name: 'exercise_answer',
      lessonId: 'u3l1',
      itemKey: 's:u3l1:0',
      exType: 'build-en',
      correct: false,
      firstTry: true,
      props: { errors: ['E8'] },
      anonId: '6f1c1b1e-6a7e-4c1a-9b7e-0d6c2f1e2a3b',
      ts: Date.UTC(2026, 9, 18, 9, 30),
      localDate: '2026-10-18',
      localHour: 12,
      appVersion: APP_VERSION,
      platform: 'android',
    };
    expect(toEventRow(event)).toEqual({
      anon_id: event.anonId,
      name: 'exercise_answer',
      lesson_id: 'u3l1',
      item_key: 's:u3l1:0',
      ex_type: 'build-en',
      correct: false,
      first_try: true,
      duration_ms: null,
      props: { errors: ['E8'] },
      client_ts: '2026-10-18T09:30:00.000Z',
      local_date: '2026-10-18',
      local_hour: 12,
      app_version: APP_VERSION,
      platform: 'android',
    });
    expect(toEventRow({ ...event, props: undefined, lessonId: null }).props).toEqual({});
    expect(Object.keys(toEventRow(event))).not.toContain('user_id');
  });

  it('formats the local date and hour from the device clock', () => {
    const ts = new Date(2026, 0, 5, 7, 3).getTime();
    expect(localContext(ts)).toEqual({ localDate: '2026-01-05', localHour: 7 });
  });

  it('creates version-4 UUIDs', () => {
    expect(randomUuid()).toMatch(UUID_RE);
    expect(randomUuid()).not.toBe(randomUuid());
  });
});

describe('analytics: flush to Supabase', () => {
  it('inserts batches of at most 50 snake_case rows into public.events', async () => {
    const { analytics, supabase, setOnline } = setup();
    setOnline(false);
    for (let i = 0; i < 120; i++) analytics.track({ name: 'hearts_out', lessonId: 'u1l1' });
    setOnline(true);
    await analytics.flush();
    expect(supabase.inserts.map((i) => i.rows.length)).toEqual([50, 50, 20]);
    expect(supabase.inserts.every((i) => i.table === 'events')).toBe(true);
    const row = supabase.inserts[0].rows[0] as Record<string, unknown>;
    expect(row.anon_id).toMatch(UUID_RE);
    expect(row.lesson_id).toBe('u1l1');
    expect(row).not.toHaveProperty('q');
    expect(row).not.toHaveProperty('anonId');
    expect(analytics.queued()).toHaveLength(0);
  });

  it('flushes on its own once 10 events are waiting', async () => {
    const { analytics, supabase } = setup();
    for (let i = 0; i < 9; i++) analytics.track({ name: 'app_open' });
    expect(supabase.inserts).toHaveLength(0);
    analytics.track({ name: 'app_open' });
    await analytics.flush();
    expect(supabase.inserts.flatMap((i) => i.rows)).toHaveLength(10);
  });

  it('keeps events while offline and sends them when the network returns (US-T1 AC3)', async () => {
    const { analytics, supabase, setOnline } = setup();
    setOnline(false);
    playLesson(analytics.track);
    await analytics.flush();
    expect(supabase.inserts).toHaveLength(0);
    expect(analytics.queued()).toHaveLength(14);
    setOnline(true);
    await analytics.flush();
    expect(supabase.inserts.flatMap((i) => i.rows)).toHaveLength(14);
    expect(analytics.queued()).toHaveLength(0);
  });

  it('removes events only after a successful insert', async () => {
    const { analytics, supabase } = setup();
    analytics.track({ name: 'app_open' });
    supabase.state.failStatus = 503;
    await analytics.flush();
    expect(analytics.queued()).toHaveLength(1);
    supabase.state.failStatus = 0;
    await analytics.flush();
    expect(analytics.queued()).toHaveLength(0);
    expect(supabase.inserts).toHaveLength(1);
  });

  it('drops a batch the database rejects as invalid instead of retrying it forever', async () => {
    const { analytics, supabase } = setup();
    analytics.track({ name: 'app_open' });
    supabase.state.failStatus = 400;
    await analytics.flush();
    expect(analytics.queued()).toHaveLength(0);
  });

  it('does not remove events tracked while an insert is in flight', async () => {
    let calls = 0;
    let trackDuring: () => void = () => {};
    const rows: unknown[][] = [];
    const client = {
      from: () => ({
        insert: async (r: unknown[]) => {
          if (calls++ === 0) trackDuring();
          rows.push(r);
          return { error: null, status: 201 };
        },
      }),
    };
    const { analytics } = setup({ getSupabase: async () => client as never });
    trackDuring = () => analytics.track({ name: 'hearts_out', props: { i: 2 } });
    analytics.track({ name: 'hearts_out', props: { i: 1 } });
    await analytics.flush();
    expect(rows.map((r) => r.map((row) => (row as { props: unknown }).props))).toEqual([[{ i: 1 }], [{ i: 2 }]]);
    expect(analytics.queued()).toHaveLength(0);
  });

  it('sends nothing when no backend is configured', async () => {
    const { analytics, fetchMock, supabase } = setup({ backend: 'none' });
    analytics.track({ name: 'app_open' });
    await analytics.flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabase.inserts).toHaveLength(0);
    expect(analytics.queued()).toHaveLength(1);
  });
});

describe('analytics: flush to the Express server', () => {
  it('POSTs camelCase events to /api/events with the bearer token', async () => {
    const { analytics, fetchMock } = setup({ backend: 'api', authToken: () => 'tok-123' });
    analytics.track({ name: 'lesson_start', lessonId: 'u2l1' });
    await analytics.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/events');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    const body = JSON.parse(init.body as string) as { events: AnalyticsEvent[] };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ name: 'lesson_start', lessonId: 'u2l1', platform: 'web' });
    expect(body.events[0]).not.toHaveProperty('q');
    expect(analytics.queued()).toHaveLength(0);
  });

  it('sends without Authorization for guests and keeps events on a network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { analytics } = setup({ backend: 'api', fetch: fetchMock as unknown as typeof fetch });
    analytics.track({ name: 'app_open' });
    await analytics.flush();
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(analytics.queued()).toHaveLength(1);
  });

  it('retries after 429/5xx and drops after 400', async () => {
    let status = 500;
    const fetchMock = vi.fn(async () => new Response(null, { status }));
    const { analytics } = setup({ backend: 'api', fetch: fetchMock as unknown as typeof fetch });
    analytics.track({ name: 'app_open' });
    await analytics.flush();
    status = 429;
    await analytics.flush();
    expect(analytics.queued()).toHaveLength(1);
    status = 400;
    await analytics.flush();
    expect(analytics.queued()).toHaveLength(0);
  });

  it('identify() queues the identify event and flushes right away', async () => {
    const { analytics, fetchMock } = setup({ backend: 'api' });
    analytics.identify();
    await analytics.flush();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) as {
      events: AnalyticsEvent[];
    };
    expect(body.events.map((e) => e.name)).toEqual(['identify']);
  });
});
