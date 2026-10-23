/**
 * Paid premium through RevenueCat (docs/subscriptions.md): what the billing-webhook Edge Function
 * reads from a webhook event and from RevenueCat's subscriber record. Pure TypeScript, no imports,
 * so the Edge Function (Deno) can import it as is and vitest can test it.
 */

/** The RevenueCat entitlement that unlocks premium (RevenueCat dashboard → Entitlements). */
export const PREMIUM_ENTITLEMENT = 'premium';

/** Where a subscription was bought; the `source` column of public.entitlements. */
export type EntitlementSource = 'play' | 'app_store' | 'web' | 'manual';

/** A row of public.entitlements, as the webhook writes it. */
export interface EntitlementRow {
  user_id: string;
  /** null: no premium from a subscription (never had one, or it was taken back). */
  premium_until: string | null;
  source: EntitlementSource | null;
  product_id: string | null;
  will_renew: boolean | null;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  /** Our learners (Supabase user ids) whose premium may have changed. */
  userIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The app logs in to RevenueCat with the Supabase user id; anonymous RevenueCat ids are not ours. */
export function isUserId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id);
}

/**
 * The event in a RevenueCat webhook body ({"api_version": "1.0", "event": {...}}), with every
 * learner it touches: the buyer and their aliases, and both sides of a TRANSFER. null when the body
 * is not an event.
 */
export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  const event = (body as { event?: unknown } | null)?.event as Record<string, unknown> | undefined;
  if (typeof event !== 'object' || event === null) return null;
  const { id, type } = event;
  if (typeof id !== 'string' || !id || typeof type !== 'string' || !type) return null;
  const ids: unknown[] = [event.app_user_id, event.original_app_user_id];
  for (const key of ['aliases', 'transferred_from', 'transferred_to']) {
    const list = event[key];
    if (Array.isArray(list)) ids.push(...list);
  }
  const userIds = [...new Set(ids.filter(isUserId).map((u) => u.toLowerCase()))];
  return { id, type, userIds };
}

const STORES: Record<string, EntitlementSource> = {
  play_store: 'play',
  app_store: 'app_store',
  mac_app_store: 'app_store',
  stripe: 'web',
  rc_billing: 'web',
  paddle: 'web',
  promotional: 'manual',
};

/** RevenueCat sends lifetime entitlements without an end; store them as "until far in the future". */
const FOREVER = '9999-12-31T00:00:00.000Z';

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * The premium entitlement in RevenueCat's subscriber record (GET /v1/subscribers/{id}):
 * until when it is paid (including a billing grace period), from which store, and whether it renews.
 * An entitlement RevenueCat doesn't list gives premium_until null.
 */
export function entitlementFromSubscriber(
  userId: string,
  data: unknown,
  now: number = Date.now(),
  entitlementId: string = PREMIUM_ENTITLEMENT,
): EntitlementRow {
  const row: EntitlementRow = {
    user_id: userId,
    premium_until: null,
    source: null,
    product_id: null,
    will_renew: null,
    updated_at: new Date(now).toISOString(),
  };
  const subscriber = (data as { subscriber?: Record<string, unknown> } | null)?.subscriber;
  const entitlements = subscriber?.entitlements as Record<string, Record<string, unknown>> | undefined;
  const ent = entitlements?.[entitlementId];
  if (typeof ent !== 'object' || ent === null) return row;

  const product = typeof ent.product_identifier === 'string' ? ent.product_identifier : null;
  const subscriptions = subscriber?.subscriptions as Record<string, Record<string, unknown>> | undefined;
  const sub = product ? subscriptions?.[product] : undefined;

  const expires = isoOrNull(ent.expires_date);
  const grace = isoOrNull(ent.grace_period_expires_date ?? sub?.grace_period_expires_date);
  row.premium_until = ent.expires_date === null ? FOREVER : grace && (!expires || grace > expires) ? grace : expires;
  row.product_id = product;
  if (sub) {
    row.source = typeof sub.store === 'string' ? (STORES[sub.store] ?? null) : null;
    row.will_renew =
      ent.expires_date !== null &&
      sub.unsubscribe_detected_at == null &&
      sub.billing_issues_detected_at == null &&
      sub.refunded_at == null;
  }
  return row;
}

/** Compares two secrets without leaking, through timing, how much of them matched. */
export function sameSecret(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Whether a webhook's Authorization header carries the shared secret. RevenueCat sends the header
 * exactly as it was typed in its dashboard, so both "<secret>" and "Bearer <secret>" are accepted.
 */
export function webhookAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const value = header.replace(/^Bearer\s+/i, '');
  return sameSecret(value, secret);
}
