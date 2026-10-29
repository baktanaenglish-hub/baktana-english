import { afterEach, describe, expect, it, vi } from 'vitest';
import { plansFromPackages, subscriptionText, trialDays, trialText, type PackageLike } from './billing';

const pkg = (
  packageType: string,
  price: number,
  priceString: string,
  extra: Partial<PackageLike['product']> = {},
): PackageLike => ({
  identifier: `$rc_${packageType.toLowerCase()}`,
  packageType,
  product: { price, priceString, ...extra },
});

const week = { freePhase: { billingPeriod: { unit: 'WEEK', value: 1 } } };

describe('plansFromPackages', () => {
  it('shows yearly first, with the monthly price and the saving', () => {
    const plans = plansFromPackages([
      pkg('MONTHLY', 19.9, '‏19.90 ₪', { defaultOption: week }),
      pkg('ANNUAL', 149, '‏149.00 ₪', { pricePerMonthString: '‏12.42 ₪', defaultOption: week }),
    ]);
    expect(plans).toEqual([
      { id: '$rc_annual', period: 'year', price: '‏149.00 ₪', perMonth: '‏12.42 ₪', trialDays: 7, savePercent: 38 },
      { id: '$rc_monthly', period: 'month', price: '‏19.90 ₪', trialDays: 7 },
    ]);
  });

  it('works with one plan and leaves out other package types', () => {
    expect(plansFromPackages([pkg('LIFETIME', 300, '300 ₪'), pkg('MONTHLY', 19.9, '19.90 ₪')])).toEqual([
      { id: '$rc_monthly', period: 'month', price: '19.90 ₪', trialDays: 0 },
    ]);
    expect(plansFromPackages([])).toEqual([]);
  });

  it('claims no saving when the yearly plan costs as much', () => {
    const [yearly] = plansFromPackages([pkg('MONTHLY', 10, '10'), pkg('ANNUAL', 120, '120')]);
    expect(yearly.savePercent).toBeUndefined();
  });
});

describe('trial', () => {
  it('counts the free phase in days', () => {
    expect(trialDays(pkg('MONTHLY', 1, '1', { defaultOption: week }))).toBe(7);
    expect(
      trialDays(pkg('MONTHLY', 1, '1', { defaultOption: { freePhase: { billingPeriod: { unit: 'DAY', value: 3 } } } })),
    ).toBe(3);
    expect(trialDays(pkg('MONTHLY', 1, '1', { defaultOption: { freePhase: null } }))).toBe(0);
    expect(trialDays(pkg('MONTHLY', 1, '1'))).toBe(0);
  });

  it('says it in Hebrew', () => {
    expect(trialText(0)).toBe('');
    expect(trialText(7)).toBe('שבוע ניסיון חינם');
    expect(trialText(3)).toBe('3 ימי ניסיון חינם');
  });
});

describe('subscriptionText', () => {
  it('says when the subscription renews or ends', () => {
    expect(subscriptionText({ premiumUntil: '2026-11-21T12:00:00Z', willRenew: true })).toBe('מתחדש ב־21 בנובמבר 2026');
    expect(subscriptionText({ premiumUntil: '2026-11-21T12:00:00Z', willRenew: false })).toBe(
      'בתוקף עד 21 בנובמבר 2026',
    );
    expect(subscriptionText({ premiumUntil: '2026-11-21T12:00:00Z' })).toBe('בתוקף עד 21 בנובמבר 2026');
  });

  it('is empty without a subscription and timeless for a lifetime one', () => {
    expect(subscriptionText(null)).toBe('');
    expect(subscriptionText({})).toBe('');
    expect(subscriptionText({ premiumUntil: 'nope' })).toBe('');
    expect(subscriptionText({ premiumUntil: '9999-12-31T00:00:00.000Z' })).toBe('ללא הגבלת זמן');
  });
});

describe('billingSupport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('./update');
  });

  async function support(play: boolean, env: Record<string, string>) {
    vi.resetModules();
    vi.doMock('./update', () => ({ isPlayBuild: async () => play }));
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { billingSupport } = await import('./billing');
    return billingSupport();
  }

  const supabase = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' };

  it('sells only in the Play build with Supabase and a RevenueCat key', async () => {
    expect(await support(true, { ...supabase, VITE_REVENUECAT_ANDROID_KEY: 'goog_x' })).toBe('store');
    expect(await support(true, { ...supabase, VITE_REVENUECAT_ANDROID_KEY: '' })).toBe('unconfigured');
    expect(await support(false, { ...supabase, VITE_REVENUECAT_ANDROID_KEY: 'goog_x' })).toBe('elsewhere');
  });

  async function offered(play: boolean, env: Record<string, string>) {
    vi.resetModules();
    vi.doMock('./update', () => ({ isPlayBuild: async () => play }));
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { premiumOffered } = await import('./billing');
    return premiumOffered();
  }

  it('offers premium only in the Play build until the public launch', async () => {
    const onSale = { ...supabase, VITE_REVENUECAT_ANDROID_KEY: 'goog_x', VITE_PREMIUM_PUBLIC: '' };
    expect(await offered(true, onSale)).toBe(true);
    expect(await offered(false, onSale)).toBe(false);
    expect(await offered(false, { ...onSale, VITE_PREMIUM_PUBLIC: 'true' })).toBe(true);
    expect(await offered(true, { ...onSale, VITE_REVENUECAT_ANDROID_KEY: '' })).toBe(false);
    expect(await offered(false, { ...onSale, VITE_REVENUECAT_ANDROID_KEY: '', VITE_PREMIUM_PUBLIC: 'true' })).toBe(
      false,
    );
  });
});

describe('RevenueCat flow', () => {
  const A = '0b7c4a52-1f0e-4c3a-9a51-2d8e6f1b9c01';
  const B = '7f3e2d1c-0b9a-4e8d-8c7b-6a5f4e3d2c1b';
  const monthly = pkg('MONTHLY', 19.9, '19.90 ₪');

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('./update');
    vi.doUnmock('@revenuecat/purchases-capacitor');
  });

  async function setup() {
    const Purchases = {
      configure: vi.fn(async () => {}),
      logIn: vi.fn(async () => ({})),
      logOut: vi.fn(async () => ({})),
      getOfferings: vi.fn(async () => ({ current: { availablePackages: [monthly] } })),
      purchasePackage: vi.fn(async (): Promise<unknown> => ({})),
      restorePurchases: vi.fn(
        async (): Promise<{ customerInfo: { entitlements: { active: Record<string, unknown> } } }> => ({
          customerInfo: { entitlements: { active: { premium: {} } } },
        }),
      ),
      // Like the Capacitor plugin proxy, which answers every property: a promise resolved with the
      // plugin itself would wait on this forever.
      then: vi.fn(),
    };
    vi.resetModules();
    vi.doMock('./update', () => ({ isPlayBuild: async () => true }));
    vi.doMock('@revenuecat/purchases-capacitor', () => ({ Purchases }));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('VITE_REVENUECAT_ANDROID_KEY', 'goog_x');
    return { Purchases, billing: await import('./billing') };
  }

  it('configures once as the learner, switches learners with logIn and logs out on sign-out', async () => {
    const { Purchases, billing } = await setup();
    await Promise.all([billing.syncBillingUser(A), billing.loadPlans(A)]);
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'goog_x', appUserID: A });
    await billing.syncBillingUser(null);
    expect(Purchases.logOut).toHaveBeenCalledTimes(1);
    await billing.syncBillingUser(B);
    expect(Purchases.logIn).toHaveBeenCalledWith({ appUserID: B });
    expect(Purchases.configure).toHaveBeenCalledTimes(1);
  });

  it('buys the chosen plan and reports a cancel or a pending payment', async () => {
    const { Purchases, billing } = await setup();
    await billing.loadPlans(A);
    await expect(billing.purchasePlan(A, '$rc_monthly')).resolves.toBe('purchased');
    expect(Purchases.purchasePackage).toHaveBeenCalledWith({ aPackage: monthly });
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '1', userCancelled: true });
    await expect(billing.purchasePlan(A, '$rc_monthly')).resolves.toBe('cancelled');
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '20' });
    await expect(billing.purchasePlan(A, '$rc_monthly')).resolves.toBe('pending');
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '10' });
    await expect(billing.purchasePlan(A, '$rc_monthly')).rejects.toThrow(billing.BILLING_OFFLINE_MESSAGE);
  });

  it('restores an existing subscription when Google says it is already owned', async () => {
    const { Purchases, billing } = await setup();
    await billing.loadPlans(A);
    Purchases.purchasePackage.mockRejectedValueOnce({ code: '6' });
    await expect(billing.purchasePlan(A, '$rc_monthly')).resolves.toBe('purchased');
    expect(Purchases.restorePurchases).toHaveBeenCalled();
    Purchases.restorePurchases.mockResolvedValueOnce({ customerInfo: { entitlements: { active: {} } } });
    await expect(billing.restorePurchases(A)).resolves.toBe(false);
  });

  it('explains when there is nothing on sale', async () => {
    const { Purchases, billing } = await setup();
    Purchases.getOfferings.mockResolvedValueOnce({ current: null } as never);
    await expect(billing.loadPlans(A)).rejects.toThrow(billing.BILLING_PLANS_MESSAGE);
  });

  it('gives up on plans that never arrive, so the screen can offer to try again', async () => {
    const { Purchases, billing } = await setup();
    vi.useFakeTimers();
    try {
      Purchases.getOfferings.mockReturnValueOnce(new Promise(() => {}) as never);
      const plans = billing.loadPlans(A);
      const result = expect(plans).rejects.toThrow(billing.BILLING_PLANS_MESSAGE);
      await vi.advanceTimersByTimeAsync(billing.PLANS_TIMEOUT_MS);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
