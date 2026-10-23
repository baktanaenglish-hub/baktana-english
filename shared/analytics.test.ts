import { describe, expect, it } from 'vitest';
import { MAX_EVENTS_PER_BATCH, sanitizeEvents, type AnalyticsEvent } from './analytics';

const NOW = Date.UTC(2026, 2, 10, 12);
const event = (over: Record<string, unknown> = {}) => ({
  name: 'exercise_answer',
  anonId: '3f2b8c1e-7d4a-4c2b-9e1f-0a1b2c3d4e5f',
  ts: NOW - 1000,
  localDate: '2026-03-10',
  localHour: 14,
  appVersion: '0.2.0',
  platform: 'android',
  lessonId: 'u3l1',
  itemKey: 'w:water',
  exType: 'build-en',
  correct: true,
  firstTry: true,
  props: { errors: ['E1'] },
  ...over,
});

describe('sanitizeEvents (US-T1 AC5)', () => {
  it('keeps a valid event with only the known fields', () => {
    const [e] = sanitizeEvents([{ ...event(), email: 'dana@example.com', userId: 'someone' }], NOW);
    expect(e).toEqual<AnalyticsEvent>({
      name: 'exercise_answer',
      anonId: '3f2b8c1e-7d4a-4c2b-9e1f-0a1b2c3d4e5f',
      ts: NOW - 1000,
      localDate: '2026-03-10',
      localHour: 14,
      appVersion: '0.2.0',
      platform: 'android',
      lessonId: 'u3l1',
      itemKey: 'w:water',
      exType: 'build-en',
      correct: true,
      firstTry: true,
      props: { errors: ['E1'] },
    });
  });

  it('accepts a minimal event and a null lessonId (review)', () => {
    const minimal = {
      name: 'app_open',
      anonId: event().anonId,
      ts: NOW,
      localDate: '2026-03-10',
      localHour: 0,
      appVersion: '',
      platform: 'web',
    };
    expect(sanitizeEvents([minimal], NOW)).toEqual([{ ...minimal, props: {} }]);
    expect(sanitizeEvents([event({ lessonId: null, durationMs: 1234 })], NOW)[0]).toMatchObject({
      lessonId: null,
      durationMs: 1234,
    });
  });

  it.each([
    ['an unknown name', { name: 'purchase' }],
    ['a non-UUID anonId', { anonId: 'abc' }],
    ['a fake date', { localDate: '2026-02-30' }],
    ['an hour out of range', { localHour: 24 }],
    ['a fractional hour', { localHour: 1.5 }],
    ['a far-future ts', { ts: NOW + 3 * 24 * 3600 * 1000 }],
    ['oversized props', { props: { blob: 'x'.repeat(1100) } }],
    ['nested props', { props: { deep: { a: 1 } } }],
    ['props as an array', { props: ['a'] }],
    ['an unknown exType', { exType: 'speak' }],
    ['an unknown platform', { platform: 'ios' }],
    ['a long lessonId', { lessonId: 'u1l1u1l1u1l1u' }],
    ['a long item key', { itemKey: `w:${'a'.repeat(80)}` }],
    ['a non-boolean correct', { correct: 'yes' }],
    ['a negative duration', { durationMs: -1 }],
    ['a duration over one hour', { durationMs: 3_600_001 }],
    ['a missing appVersion', { appVersion: undefined }],
  ])('drops an event with %s', (_label, over) => {
    expect(sanitizeEvents([event(over)], NOW)).toEqual([]);
  });

  it(`keeps the valid events of a mixed batch, at most ${MAX_EVENTS_PER_BATCH}`, () => {
    expect(
      sanitizeEvents([event(), event({ name: 'nope' }), 'junk', null, event({ name: 'lesson_start' })], NOW),
    ).toHaveLength(2);
    expect(
      sanitizeEvents(
        Array.from({ length: 51 }, () => event()),
        NOW,
      ),
    ).toHaveLength(MAX_EVENTS_PER_BATCH);
  });

  it('returns [] for anything but an array', () => {
    for (const v of [undefined, null, {}, 'x', event()]) expect(sanitizeEvents(v, NOW)).toEqual([]);
  });
});
