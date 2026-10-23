/**
 * Build-time switches.
 * - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY: accounts and the league run on Supabase
 *   (used by the static site and the Android app, which have no API server).
 * - Otherwise accounts use the Express server under /api, unless the build sets
 *   VITE_ENABLE_ACCOUNTS=false, which hides sign-in and the league.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const ACCOUNTS_ENABLED = USE_SUPABASE || import.meta.env.VITE_ENABLE_ACCOUNTS !== 'false';
/** "Forgot password" sends an email, which only the Supabase backend can do. */
export const PASSWORD_RESET = USE_SUPABASE;

/**
 * True when the page was opened from a password-reset email: Supabase appends
 * `#access_token=…&type=recovery`. Read before supabase-js starts, since it clears the hash.
 */
export function isPasswordRecoveryLink(hash = typeof window === 'undefined' ? '' : window.location.hash): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'recovery';
}

/**
 * The public web app, where links in Supabase emails (e.g. "confirm your account") open.
 * Builds set VITE_SITE_URL once the site has its own domain (docs/domain.md); until then the
 * GitHub Pages address.
 */
export const PUBLIC_SITE_URL: string =
  import.meta.env.VITE_SITE_URL || 'https://baktanaenglish-hub.github.io/baktana-english/';

/**
 * The privacy policy and terms (public/privacy.html, public/terms.html). Always the public
 * site's copy, so the app stores have a stable address and the Android app opens them in the
 * browser instead of inside the app.
 */
export const PRIVACY_URL = new URL('privacy.html', PUBLIC_SITE_URL).href;
export const TERMS_URL = new URL('terms.html', PUBLIC_SITE_URL).href;

/**
 * Where the confirmation link sends the learner: this site when it runs on the web (the
 * app's own base path, so GitHub Pages' sub-path is kept), the public site from the Android
 * app, whose https://localhost origin does not exist outside the phone.
 */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return PUBLIC_SITE_URL;
  if (window.location.hostname === 'localhost' && !import.meta.env.DEV) return PUBLIC_SITE_URL;
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
