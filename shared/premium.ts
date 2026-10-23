/**
 * Premium access for the AI video call (shared/call.ts). A learner is premium when their email is on
 * the server-side allowlist in the PREMIUM_EMAILS environment variable (the owner, testers, gifts –
 * never hardcode an email here), or, on Supabase, when a paid subscription is still valid (isEntitled).
 * Pure TypeScript, no imports, so the Supabase Edge Function (Deno) can import it as is.
 */

/** PREMIUM_EMAILS (comma-separated) → a set of trimmed, lowercased emails. Empty entries are ignored. */
export function parsePremiumEmails(raw?: string): Set<string> {
  const set = new Set<string>();
  for (const part of (raw ?? '').split(',')) {
    const email = part.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

/** Whether the account's email is on the allowlist (case-insensitive). */
export function isPremium(email: string | null | undefined, premium: Set<string>): boolean {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized !== '' && premium.has(normalized);
}

/**
 * Extra time past `premium_until` before a subscription stops counting: Google renews a day or so
 * before the period ends, but the webhook that moves `premium_until` forward can lag behind.
 */
export const PREMIUM_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a paid subscription (public.entitlements.premium_until, docs/subscriptions.md) still
 * counts at `now`. Missing or unreadable dates are not premium.
 */
export function isEntitled(
  premiumUntil: string | null | undefined,
  now: number = Date.now(),
  graceMs: number = PREMIUM_GRACE_MS,
): boolean {
  if (typeof premiumUntil !== 'string' || !premiumUntil) return false;
  const until = Date.parse(premiumUntil);
  return Number.isFinite(until) && until + graceMs > now;
}

/**
 * A turn whose history has no learner message starts a new call (counts toward
 * CALL_LIMITS.callsPerDay). Anything that isn't an array counts as an empty history.
 */
export function isNewCall(history: unknown): boolean {
  if (!Array.isArray(history)) return true;
  return !history.some((m) => (m as { role?: unknown } | null)?.role === 'user');
}

/**
 * The day usage is counted on, as YYYY-MM-DD. With `timeZone` (e.g. 'Asia/Jerusalem') the date in
 * that zone; without it the process's local date (the Express server sets TZ=Asia/Jerusalem).
 */
export function usageDay(now: number = Date.now(), timeZone?: string): string {
  const d = new Date(now);
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
