/**
 * Supabase Edge Function: RevenueCat's webhook for paid premium (docs/subscriptions.md). Every
 * purchase, renewal, cancellation, refund or expiry in Google Play reaches RevenueCat, which POSTs
 * an event here; this function asks RevenueCat for the learner's current state and writes it to
 * public.entitlements, which call-turn reads to decide who is premium.
 *
 * Contract:
 *   POST <SUPABASE_URL>/functions/v1/billing-webhook
 *   Headers: `Authorization: <REVENUECAT_WEBHOOK_SECRET>` (with or without "Bearer "), as set in the
 *   RevenueCat dashboard → Integrations → Webhooks.
 *   200 handled (or already handled, or not about one of our learners), 401 wrong secret,
 *   400 not an event, 503 secrets missing, 502 RevenueCat or the database failed – RevenueCat retries.
 *
 * Events can arrive late, twice or out of order, so the event itself is only a hint: the state
 * always comes from RevenueCat's REST API (GET /v1/subscribers/{app_user_id}, REVENUECAT_API_KEY).
 * The app logs in to RevenueCat with the Supabase user id, so app_user_id is our auth.users id.
 * Handled event ids go to public.billing_events and a repeat delivery is skipped.
 *
 * Deploy: `supabase functions deploy billing-webhook --no-verify-jwt` (RevenueCat has no Supabase
 * token), `supabase secrets set REVENUECAT_WEBHOOK_SECRET=... REVENUECAT_API_KEY=...`.
 * Nothing about the purchase beyond the learner id and the event type is logged.
 */
import { entitlementFromSubscriber, parseWebhookEvent, webhookAuthorized } from '../../../shared/billing.ts';
import type { EntitlementRow } from '../../../shared/billing.ts';

const REVENUECAT_API = 'https://api.revenuecat.com/v1';
const TIMEOUT_MS = 10_000;

class HttpError extends Error {
  constructor(readonly status: number) {
    super(String(status));
  }
}

function supabaseEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new HttpError(503);
  return { url: url.replace(/\/+$/, ''), serviceKey };
}

/** Headers for a service-role request. New `sb_secret_…` keys are not JWTs and go in `apikey` only. */
function serviceHeaders(serviceKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  return headers;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, serviceKey } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(serviceKey), ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res) {
    console.warn(`[billing-webhook] database request failed (${path.split('?')[0]})`);
    throw new HttpError(502);
  }
  return res;
}

async function alreadyHandled(eventId: string): Promise<boolean> {
  const res = await rest(`billing_events?select=event_id&event_id=eq.${encodeURIComponent(eventId)}`);
  if (!res.ok) {
    console.warn(`[billing-webhook] event read failed (${res.status})`);
    throw new HttpError(502);
  }
  const rows = (await res.json().catch(() => null)) as unknown[] | null;
  return Array.isArray(rows) && rows.length > 0;
}

async function markHandled(eventId: string, type: string): Promise<void> {
  const res = await rest('billing_events?on_conflict=event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ event_id: eventId, type }),
  });
  // Not fatal: the entitlement is already written; a repeat delivery would only write it again.
  if (!res.ok) console.warn(`[billing-webhook] event write failed (${res.status})`);
}

/** The learner's subscriber record in RevenueCat (always the current state). */
async function subscriber(userId: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${REVENUECAT_API}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (res?.status === 404) return null;
  if (!res?.ok) {
    console.warn(`[billing-webhook] RevenueCat status ${res?.status ?? 'unreachable'}`);
    throw new HttpError(502);
  }
  return res.json().catch(() => {
    throw new HttpError(502);
  });
}

async function saveEntitlement(row: EntitlementRow): Promise<void> {
  const res = await rest('entitlements?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  // 409: the learner deleted their account (no auth.users row) – nothing to keep.
  if (res.status === 409) return;
  if (!res.ok) {
    console.warn(`[billing-webhook] entitlement write failed (${res.status})`);
    throw new HttpError(502);
  }
}

async function handle(request: Request): Promise<number> {
  if (!webhookAuthorized(request.headers.get('authorization'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET'))) {
    // Without the secret set nothing can be checked, so nothing is accepted.
    return Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ? 401 : 503;
  }
  const apiKey = Deno.env.get('REVENUECAT_API_KEY');
  if (!apiKey) return 503;
  supabaseEnv();

  const event = parseWebhookEvent(await request.json().catch(() => null));
  if (!event) return 400;
  if (event.userIds.length === 0) {
    // A dashboard test event, or a purchase made before signing in (not possible from the app).
    console.log(`[billing-webhook] ${event.type}: no learner`);
    return 200;
  }
  if (await alreadyHandled(event.id)) return 200;

  for (const userId of event.userIds) {
    await saveEntitlement(entitlementFromSubscriber(userId, await subscriber(userId, apiKey)));
  }
  await markHandled(event.id, event.type);
  console.log(`[billing-webhook] ${event.type}: ${event.userIds.length} learner(s) updated`);
  return 200;
}

Deno.serve(async (request) => {
  const json = (status: number) =>
    new Response(JSON.stringify({ ok: status === 200 }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  if (request.method !== 'POST') return json(405);
  try {
    return json(await handle(request));
  } catch (err) {
    if (err instanceof HttpError) return json(err.status);
    console.error('[billing-webhook] unexpected error');
    return json(500);
  }
});
