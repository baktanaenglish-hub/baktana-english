import { USE_SUPABASE } from './config';
import { isPlayBuild } from './update';

/**
 * Buying premium in the Google Play edition of the app, through RevenueCat
 * (@revenuecat/purchases-capacitor, docs/subscriptions.md). The app never decides who is premium:
 * a purchase reaches RevenueCat, its webhook updates Supabase (supabase/functions/billing-webhook),
 * and the app reads the result from call-turn's status like before. This module only shows plans,
 * starts a purchase and restores one.
 *
 * Billing is offered only in the Play build, on Supabase, with VITE_REVENUECAT_ANDROID_KEY (the
 * public SDK key) set at build time; the website and the sideloaded APK say where to subscribe.
 * RevenueCat knows the learner by their Supabase user id, so buying needs a signed-in learner.
 */

export const REVENUECAT_ANDROID_KEY: string = import.meta.env.VITE_REVENUECAT_ANDROID_KEY ?? '';

/**
 * Premium is on sale once the RevenueCat key is set (the website and APK builds get it too). Until
 * then the app shows "coming soon" everywhere and doesn't offer the premium screen.
 */
export const PREMIUM_ON_SALE = Boolean(REVENUECAT_ANDROID_KEY);

/**
 * Whether the website and the sideloaded APK advertise premium too (VITE_PREMIUM_PUBLIC=true, set at
 * the public launch). Before that only the Play edition offers it, so closed testers can buy while
 * the other builds keep saying "coming soon" instead of linking to a Play listing that isn't public.
 */
const PREMIUM_PUBLIC = import.meta.env.VITE_PREMIUM_PUBLIC === 'true';

/** The Play edition's application id (android/app/build.gradle, flavor "play"). */
export const PLAY_PACKAGE = 'com.baktana.english';
/** The subscription's product id in Play Console → Monetize → Subscriptions. */
export const PREMIUM_PRODUCT = 'premium';
/** Google Play's page for managing (and cancelling) this subscription. */
export const MANAGE_SUBSCRIPTION_URL = `https://play.google.com/store/account/subscriptions?sku=${PREMIUM_PRODUCT}&package=${PLAY_PACKAGE}`;
/** The app's page in Google Play, for learners on the website or the sideloaded APK. */
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;
/** The RevenueCat entitlement that means premium (shared/billing.ts PREMIUM_ENTITLEMENT). */
const ENTITLEMENT = 'premium';

export const BILLING_ERROR_MESSAGE = 'הרכישה לא הושלמה. נסו שוב בעוד רגע.';
export const BILLING_OFFLINE_MESSAGE = 'אין חיבור ל־Google Play כרגע. בדקו את החיבור לאינטרנט ונסו שוב.';
export const BILLING_PLANS_MESSAGE = 'לא הצלחנו לטעון את המחירים. נסו שוב בעוד רגע.';

export class BillingError extends Error {}

/**
 * - store: this build can sell premium.
 * - unconfigured: the Play build, but the RevenueCat key isn't set yet (before the launch).
 * - elsewhere: the website or the sideloaded APK – premium is bought in the Play app.
 */
export type BillingSupport = 'store' | 'unconfigured' | 'elsewhere';

let support: Promise<BillingSupport> | undefined;

export function billingSupport(): Promise<BillingSupport> {
  support ??= isPlayBuild().then((play) =>
    !play ? 'elsewhere' : REVENUECAT_ANDROID_KEY && USE_SUPABASE ? 'store' : 'unconfigured',
  );
  return support;
}

/** Whether this build offers the premium screen: see PREMIUM_ON_SALE and PREMIUM_PUBLIC. */
export async function premiumOffered(): Promise<boolean> {
  if (!PREMIUM_ON_SALE) return false;
  const s = await billingSupport();
  return s === 'store' || (s === 'elsewhere' && PREMIUM_PUBLIC);
}

// ---------- Plans (pure, tested) ----------

/** The parts of a RevenueCat package that the paywall shows. */
export interface PackageLike {
  identifier: string;
  packageType: string;
  product: {
    priceString: string;
    price: number;
    pricePerMonthString?: string | null;
    defaultOption?: { freePhase?: { billingPeriod: { unit: string; value: number } } | null } | null;
  };
}

export interface Plan {
  /** The RevenueCat package identifier (e.g. "$rc_monthly"). */
  id: string;
  period: 'month' | 'year';
  /** As Google Play formats it for the learner's country, e.g. "‏19.90 ₪". */
  price: string;
  /** Yearly plans: the price per month, as Google Play formats it. */
  perMonth?: string;
  /** Days of free trial the learner can still get (0 when none). */
  trialDays: number;
  /** Yearly plans: percent saved against twelve months of the monthly plan. */
  savePercent?: number;
}

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** The free trial in a subscription option, in days (0 when there is none). */
export function trialDays(pkg: PackageLike): number {
  const period = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (!period || !(period.value > 0)) return 0;
  return Math.round((DAYS[period.unit] ?? 0) * period.value);
}

/** The monthly and yearly plans in an offering, yearly first; other package types are left out. */
export function plansFromPackages(packages: readonly PackageLike[]): Plan[] {
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const yearly = packages.find((p) => p.packageType === 'ANNUAL');
  const plans: Plan[] = [];
  if (yearly) {
    const plan: Plan = {
      id: yearly.identifier,
      period: 'year',
      price: yearly.product.priceString,
      trialDays: trialDays(yearly),
    };
    if (yearly.product.pricePerMonthString) plan.perMonth = yearly.product.pricePerMonthString;
    if (monthly && monthly.product.price > 0) {
      const save = Math.round((1 - yearly.product.price / (monthly.product.price * 12)) * 100);
      if (save > 0) plan.savePercent = save;
    }
    plans.push(plan);
  }
  if (monthly) {
    plans.push({
      id: monthly.identifier,
      period: 'month',
      price: monthly.product.priceString,
      trialDays: trialDays(monthly),
    });
  }
  return plans;
}

/** "7 ימי ניסיון חינם", "חודש ניסיון חינם" … */
export function trialText(days: number): string {
  if (days <= 0) return '';
  if (days === 1) return 'יום ניסיון חינם';
  if (days === 7) return 'שבוע ניסיון חינם';
  if (days === 30) return 'חודש ניסיון חינם';
  return `${days} ימי ניסיון חינם`;
}

/**
 * The subscription line under the premium badge: "מתחדש ב־21 בנובמבר 2026", "בתוקף עד …", or
 * nothing when premium doesn't come from a subscription (the allowlist).
 */
export function subscriptionText(status: { premiumUntil?: string; willRenew?: boolean } | null): string {
  if (!status?.premiumUntil) return '';
  const until = new Date(status.premiumUntil);
  if (Number.isNaN(until.getTime())) return '';
  if (until.getUTCFullYear() >= 9999) return 'ללא הגבלת זמן';
  const date = until.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  return status.willRenew ? `מתחדש ב־${date}` : `בתוקף עד ${date}`;
}

// ---------- RevenueCat ----------

type PurchasesModule = typeof import('@revenuecat/purchases-capacitor');

let sdk: Promise<PurchasesModule> | undefined;
/** Purchases.configure has run (it may only run once). */
let configured = false;
/** The learner RevenueCat is logged in as (null: anonymous, e.g. after signing out). */
let loggedIn: string | null = null;
/** The login step in progress (see serialized). */
let queue: Promise<unknown> = Promise.resolve();
/** Packages of the last offering shown, by identifier (purchasePackage needs the original object). */
const packages = new Map<string, unknown>();

function load(): Promise<PurchasesModule> {
  sdk ??= import('@revenuecat/purchases-capacitor');
  return sdk;
}

/**
 * Runs RevenueCat's login steps one at a time: the app's sign-in sync and the premium screen
 * can both start at launch, and the SDK must be configured exactly once.
 */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/** RevenueCat, logged in as this learner. */
async function purchasesFor(userId: string): Promise<PurchasesModule['Purchases']> {
  if ((await billingSupport()) !== 'store') throw new BillingError(BILLING_ERROR_MESSAGE);
  const { Purchases } = await load();
  await serialized(async () => {
    if (!configured) {
      await Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY, appUserID: userId });
      configured = true;
      loggedIn = userId;
    } else if (loggedIn !== userId) {
      await Purchases.logIn({ appUserID: userId });
      loggedIn = userId;
      packages.clear();
    }
  });
  return Purchases;
}

/**
 * Keeps RevenueCat's user in step with the signed-in learner (App calls it when the learner
 * changes). Signing out logs RevenueCat out, so the next learner's purchases aren't mixed up.
 */
export async function syncBillingUser(userId: string | null): Promise<void> {
  try {
    if (userId) {
      if ((await billingSupport()) === 'store') await purchasesFor(userId);
    } else if (configured) {
      const { Purchases } = await load();
      await serialized(async () => {
        if (loggedIn === null) return;
        loggedIn = null;
        packages.clear();
        await Purchases.logOut();
      });
    }
  } catch {
    // Offline or the store is busy: the next purchase or restore logs in again.
  }
}

interface PurchasesErrorLike {
  code?: string;
  userCancelled?: boolean | null;
}

function billingError(err: unknown): BillingError {
  const code = (err as PurchasesErrorLike | null)?.code;
  if (code === '10' || code === '35') return new BillingError(BILLING_OFFLINE_MESSAGE);
  if (code === '3') return new BillingError('הרכישה לא מותרת במכשיר הזה (למשל בגלל הגבלת הורים ב־Google Play).');
  if (code === '15') return new BillingError('רכישה כבר מתבצעת. חכו רגע ונסו שוב.');
  return err instanceof BillingError ? err : new BillingError(BILLING_ERROR_MESSAGE);
}

/** How long the plans may take to arrive from Google Play before the screen offers to try again. */
export const PLANS_TIMEOUT_MS = 20_000;

/** The plans on sale, with prices from Google Play. Throws BillingError (Hebrew). */
export async function loadPlans(userId: string): Promise<Plan[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const Purchases = await purchasesFor(userId);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BillingError(BILLING_PLANS_MESSAGE)), PLANS_TIMEOUT_MS);
    });
    const offerings = await Promise.race([Purchases.getOfferings(), timeout]);
    const available = offerings.current?.availablePackages ?? [];
    packages.clear();
    for (const p of available) packages.set(p.identifier, p);
    const plans = plansFromPackages(available);
    if (plans.length === 0) throw new BillingError(BILLING_PLANS_MESSAGE);
    return plans;
  } catch (err) {
    throw err instanceof BillingError ? err : billingError(err);
  } finally {
    clearTimeout(timer);
  }
}

/** The result of a purchase: active right away, cancelled by the learner, or waiting for payment. */
export type PurchaseResult = 'purchased' | 'cancelled' | 'pending';

/** Opens Google Play's purchase sheet for a plan from loadPlans. Throws BillingError (Hebrew). */
export async function purchasePlan(userId: string, planId: string): Promise<PurchaseResult> {
  const Purchases = await purchasesFor(userId).catch((err: unknown) => {
    throw billingError(err);
  });
  const aPackage = packages.get(planId);
  if (!aPackage) throw new BillingError(BILLING_PLANS_MESSAGE);
  try {
    await Purchases.purchasePackage({
      aPackage: aPackage as Parameters<typeof Purchases.purchasePackage>[0]['aPackage'],
    });
    return 'purchased';
  } catch (err) {
    const e = err as PurchasesErrorLike | null;
    if (e?.userCancelled || e?.code === '1') return 'cancelled';
    if (e?.code === '20') return 'pending';
    // Already subscribed on this Google account: restoring links it to this learner.
    if (e?.code === '6') return (await restorePurchases(userId)) ? 'purchased' : 'cancelled';
    throw billingError(err);
  }
}

/**
 * Links this Google account's subscription to the signed-in learner (a new phone, a reinstall).
 * Resolves whether premium is active. Throws BillingError (Hebrew).
 */
export async function restorePurchases(userId: string): Promise<boolean> {
  try {
    const Purchases = await purchasesFor(userId);
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[ENTITLEMENT] !== undefined;
  } catch (err) {
    throw billingError(err);
  }
}
