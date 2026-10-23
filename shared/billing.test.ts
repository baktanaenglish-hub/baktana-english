import { describe, expect, it } from 'vitest';
import { entitlementFromSubscriber, isUserId, parseWebhookEvent, sameSecret, webhookAuthorized } from './billing';

const A = '0b7c4a52-1f0e-4c3a-9a51-2d8e6f1b9c01';
const B = '7f3e2d1c-0b9a-4e8d-8c7b-6a5f4e3d2c1b';
const NOW = Date.parse('2026-10-21T12:00:00Z');

describe('isUserId', () => {
  it('accepts Supabase user ids only', () => {
    expect(isUserId(A)).toBe(true);
    expect(isUserId(A.toUpperCase())).toBe(true);
    expect(isUserId('$RCAnonymousID:8f9e0a1b2c3d')).toBe(false);
    expect(isUserId('')).toBe(false);
    expect(isUserId(42)).toBe(false);
  });
});

describe('parseWebhookEvent', () => {
  it('reads the id, the type and the buyer with their aliases', () => {
    const body = {
      api_version: '1.0',
      event: {
        id: 'evt-1',
        type: 'INITIAL_PURCHASE',
        app_user_id: A,
        original_app_user_id: '$RCAnonymousID:abc',
        aliases: [A, '$RCAnonymousID:abc'],
      },
    };
    expect(parseWebhookEvent(body)).toEqual({ id: 'evt-1', type: 'INITIAL_PURCHASE', userIds: [A] });
  });

  it('takes both sides of a transfer, lowercased and without duplicates', () => {
    const body = {
      event: { id: 'evt-2', type: 'TRANSFER', transferred_from: [A.toUpperCase()], transferred_to: [B, A] },
    };
    expect(parseWebhookEvent(body)?.userIds).toEqual([A, B]);
  });

  it('keeps a test event without learners', () => {
    expect(parseWebhookEvent({ event: { id: 't', type: 'TEST', app_user_id: 'test' } })).toEqual({
      id: 't',
      type: 'TEST',
      userIds: [],
    });
  });

  it('rejects bodies that are not events', () => {
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent({})).toBeNull();
    expect(parseWebhookEvent({ event: { type: 'RENEWAL' } })).toBeNull();
    expect(parseWebhookEvent({ event: { id: 'x' } })).toBeNull();
  });
});

describe('entitlementFromSubscriber', () => {
  const subscriber = (entitlement: Record<string, unknown> | undefined, sub: Record<string, unknown> = {}) => ({
    subscriber: {
      entitlements: entitlement ? { premium: { product_identifier: 'premium:monthly', ...entitlement } } : {},
      subscriptions: {
        'premium:monthly': {
          store: 'play_store',
          unsubscribe_detected_at: null,
          billing_issues_detected_at: null,
          refunded_at: null,
          ...sub,
        },
      },
    },
  });

  it('reads an active, renewing Play subscription', () => {
    expect(entitlementFromSubscriber(A, subscriber({ expires_date: '2026-11-21T12:00:00Z' }), NOW)).toEqual({
      user_id: A,
      premium_until: '2026-11-21T12:00:00.000Z',
      source: 'play',
      product_id: 'premium:monthly',
      will_renew: true,
      updated_at: '2026-10-21T12:00:00.000Z',
    });
  });

  it('marks a cancelled or failing subscription as not renewing', () => {
    const cancelled = subscriber(
      { expires_date: '2026-11-01T00:00:00Z' },
      { unsubscribe_detected_at: '2026-10-20T00:00:00Z' },
    );
    expect(entitlementFromSubscriber(A, cancelled, NOW).will_renew).toBe(false);
    const billing = subscriber(
      { expires_date: '2026-11-01T00:00:00Z' },
      { billing_issues_detected_at: '2026-10-20T00:00:00Z' },
    );
    expect(entitlementFromSubscriber(A, billing, NOW).will_renew).toBe(false);
  });

  it('extends premium through a billing grace period', () => {
    const data = subscriber({
      expires_date: '2026-10-20T00:00:00Z',
      grace_period_expires_date: '2026-10-27T00:00:00Z',
    });
    expect(entitlementFromSubscriber(A, data, NOW).premium_until).toBe('2026-10-27T00:00:00.000Z');
    const subGrace = subscriber(
      { expires_date: '2026-10-20T00:00:00Z' },
      { grace_period_expires_date: '2026-10-25T00:00:00Z' },
    );
    expect(entitlementFromSubscriber(A, subGrace, NOW).premium_until).toBe('2026-10-25T00:00:00.000Z');
  });

  it('stores a lifetime entitlement as far in the future', () => {
    const row = entitlementFromSubscriber(A, subscriber({ expires_date: null }), NOW);
    expect(row.premium_until).toBe('9999-12-31T00:00:00.000Z');
    expect(row.will_renew).toBe(false);
  });

  it('gives no premium when RevenueCat lists no entitlement', () => {
    const row = entitlementFromSubscriber(A, subscriber(undefined), NOW);
    expect(row).toMatchObject({ user_id: A, premium_until: null, source: null, product_id: null, will_renew: null });
    expect(entitlementFromSubscriber(A, null, NOW).premium_until).toBeNull();
    expect(entitlementFromSubscriber(A, { subscriber: {} }, NOW).premium_until).toBeNull();
  });

  it('maps stores and leaves unknown ones empty', () => {
    expect(
      entitlementFromSubscriber(A, subscriber({ expires_date: '2027-01-01T00:00:00Z' }, { store: 'app_store' }), NOW)
        .source,
    ).toBe('app_store');
    expect(
      entitlementFromSubscriber(A, subscriber({ expires_date: '2027-01-01T00:00:00Z' }, { store: 'promotional' }), NOW)
        .source,
    ).toBe('manual');
    expect(
      entitlementFromSubscriber(A, subscriber({ expires_date: '2027-01-01T00:00:00Z' }, { store: 'amazon' }), NOW)
        .source,
    ).toBeNull();
  });
});

describe('webhook secret', () => {
  it('compares secrets exactly', () => {
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret('abc', 'abcd')).toBe(false);
    expect(sameSecret('', '')).toBe(true);
  });

  it('accepts the secret with or without "Bearer"', () => {
    expect(webhookAuthorized('s3cret', 's3cret')).toBe(true);
    expect(webhookAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(webhookAuthorized('Bearer wrong', 's3cret')).toBe(false);
    expect(webhookAuthorized(null, 's3cret')).toBe(false);
    expect(webhookAuthorized('', '')).toBe(false);
    expect(webhookAuthorized('anything', undefined)).toBe(false);
  });
});
