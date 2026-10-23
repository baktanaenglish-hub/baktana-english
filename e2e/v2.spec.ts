/**
 * End-to-end acceptance tests for release v2 (docs/spec/v2.md §9) that the first pass in
 * app.spec.ts does not cover: the review card and button, offline review and seeding,
 * SRS upload on sign-up, the analytics opt-out and when the sign-up offer stays hidden.
 */
import { expect, test, type Page } from '@playwright/test';
import { wordKey } from '../shared/item-keys';
import type { AnalyticsEvent } from '../shared/analytics';
import type { Lesson } from '../src/types';
import {
  AUTH_KEY,
  EVENTS_KEY,
  SRS_KEY,
  browserDate,
  finishLesson,
  lesson,
  localSrs,
  openFresh,
  openLesson,
  recordSpeech,
  seedProgress,
  seedSrs,
  token,
} from './helpers';

const L1 = lesson('u1l1');
let counter = 0;
const uniqueEmail = () => `e2e-v2-${Date.now()}-${counter++}@example.com`;

const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
};

async function tab(page: Page, name: 'לימוד' | 'ליגה' | 'פרופיל') {
  await page.locator('.bottom-nav').getByRole('button', { name }).click();
}

const queuedEvents = (page: Page): Promise<AnalyticsEvent[] | null> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), EVENTS_KEY);

/** Every lesson up to and including `id`, merged into one, so review exercises can be answered. */
function lessonsThrough(...ids: string[]): Lesson {
  const ls = ids.map(lesson);
  return { ...ls[0], words: ls.flatMap((l) => l.words), sentences: ls.flatMap((l) => l.sentences) };
}

test.describe('v2 review (US-R1, US-R5, US-R6)', () => {
  test('US-R1 AC2: 2 items due → "🧠 חזרה (2)" without a pinned card', async ({ page }) => {
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await seedSrs(page, L1.words.slice(0, 2).map(wordKey));
    await page.goto('/');
    await expect(page.locator('.practice-btn')).toHaveText('🧠 חזרה (2)');
    await expect(page.locator('.practice-btn')).toBeEnabled();
    await expect(page.locator('.review-card')).toHaveCount(0);
  });

  test('US-R1 AC1: nothing due and a completed lesson → "💪 תרגול", enabled, no card', async ({ page }) => {
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await seedSrs(page, L1.words.map(wordKey), { box: 2, dueInDays: 3 });
    await page.goto('/');
    await expect(page.locator('.practice-btn')).toHaveText('💪 תרגול');
    await expect(page.locator('.practice-btn')).toBeEnabled();
    await expect(page.locator('.review-card')).toHaveCount(0);
  });

  test('US-R1 AC3, US-R5 AC1: 3 due items pin a card that opens a review; offline, the result survives a reload', async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    const due = L1.words.slice(0, 3).map(wordKey);
    await seedSrs(page, due);
    await page.goto('/');

    const card = page.locator('.review-card');
    await expect(card).toContainText('יש לך 3 מילים ומשפטים לחזרה');
    await expect(page.locator('.practice-btn')).toHaveText('🧠 חזרה (3)');
    await card.getByRole('button', { name: 'לחזרה' }).click();
    await expect(page.locator('.lesson-header .practice-badge')).toBeVisible();
    await finishLesson(page, L1);
    await expect(page.locator('.lesson-complete h2')).toHaveText('החזרה הושלמה!');
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.locator('.review-card')).toHaveCount(0);

    // Right answers on due box-1 items move them to box 2, due in 3 days – kept after a reload.
    const inThreeDays = await browserDate(page, 3);
    await page.reload();
    await expect(page.locator('.path')).toBeVisible();
    await expect(page.locator('.review-card')).toHaveCount(0);
    const srs = await localSrs(page);
    for (const key of due) expect(srs?.items[key], key).toMatchObject({ box: 2, due: inThreeDays, seen: 2 });
    expect(errors).toEqual([]);
  });

  test('US-R5 AC2: a corrupt or blocked SRS store does not break the app; a review still runs', async ({ page }) => {
    const errors = pageErrors(page);
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await page.addInitScript((key) => localStorage.setItem(key, '{not json'), SRS_KEY);
    await page.goto('/');
    await expect(page.locator('.practice-btn')).toBeEnabled();
    await page.locator('.practice-btn').click();
    await finishLesson(page, L1);
    await expect(page.locator('.lesson-complete h2')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('US-R5 AC2: with the SRS key blocked by storage errors the app still starts and a review runs', async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await page.addInitScript((key) => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k: string) {
        if (k === key) throw new DOMException('blocked', 'SecurityError');
        return get.call(this, k);
      };
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === key) throw new DOMException('blocked', 'QuotaExceededError');
        return set.call(this, k, v);
      };
    }, SRS_KEY);
    await page.goto('/');
    await expect(page.locator('.practice-btn')).toBeEnabled();
    await page.locator('.practice-btn').click();
    await finishLesson(page, L1);
    await expect(page.locator('.lesson-complete h2')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('US-R5 AC3: progress from before the release is seeded once – 25 words and 16 sentences in box 1', async ({
    page,
  }) => {
    const done = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2'];
    await recordSpeech(page);
    await seedProgress(page, { completed: Object.fromEntries(done.map((id) => [id, 1])), xp: 75 });
    await page.goto('/');
    await expect(page.locator('.path')).toBeVisible();
    await expect.poll(async () => Object.keys((await localSrs(page))?.items ?? {}).length).toBe(41);
    const first = (await localSrs(page))!;
    const keys = Object.keys(first.items);
    expect(keys.filter((k) => k.startsWith('w:'))).toHaveLength(25);
    expect(keys.filter((k) => k.startsWith('s:'))).toHaveLength(16);
    const [today, last] = [await browserDate(page), await browserDate(page, 6)];
    for (const item of Object.values(first.items)) {
      expect(item).toMatchObject({ box: 1, seen: 1, wrong: 0, last: 0 });
      expect(item.due >= today && item.due <= last, item.due).toBe(true);
    }
    expect(first.seeded).toBe(true);
    expect(first.dirty).toEqual([]);

    await page.reload();
    await expect(page.locator('.path')).toBeVisible();
    expect(await localSrs(page)).toEqual(first);
  });

  test('US-R6 AC5, US-S1 AC2: a guest who signs up from the offer uploads every local item, and the events say so', async ({
    page,
  }) => {
    const posted: AnalyticsEvent[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().endsWith('/api/events')) {
        posted.push(...((req.postDataJSON() as { events: AnalyticsEvent[] }).events ?? []));
      }
    });
    await openFresh(page);
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    await page.locator('.signup-prompt').getByRole('button', { name: 'הרשמה' }).click();
    await page.getByLabel('שם תצוגה').fill('חזרה');
    await page.getByLabel('אימייל').fill(uniqueEmail());
    await page.getByLabel('סיסמה').fill('password123');
    await page.getByRole('button', { name: 'יצירת חשבון' }).click();
    await expect(page.locator('.path')).toBeVisible();

    const local = Object.keys((await localSrs(page))?.items ?? {});
    expect(local.length).toBeGreaterThanOrEqual(L1.words.length);
    const t = await token(page);
    await expect
      .poll(async () => {
        const res = await page.request.get('/api/srs', { headers: { Authorization: `Bearer ${t}` } });
        return Object.keys(((await res.json()) as { items: Record<string, unknown> }).items).sort();
      })
      .toEqual([...local].sort());
    await expect.poll(async () => (await localSrs(page))?.dirty).toEqual([]);

    // signup_complete{from:'prompt'} and identify reach the server (identify flushes the queue).
    await expect.poll(() => posted.map((e) => e.name)).toContain('identify');
    expect(posted.find((e) => e.name === 'signup_complete')?.props).toEqual({ from: 'prompt' });
    // No e-mail, name or password in any event (US-T1 AC2).
    expect(JSON.stringify(posted)).not.toMatch(/@|password|חזרה/);
  });

  test('regression: signing in on a fresh install seeds the review items from the pulled progress', async ({
    page,
  }) => {
    const email = uniqueEmail();
    const res = await page.request.post('/api/auth/register', {
      data: { email, password: 'password123', displayName: 'מכשיר חדש' },
    });
    const auth = (await res.json()) as { token: string };
    const done = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2'];
    const put = await page.request.put('/api/progress', {
      headers: { Authorization: `Bearer ${auth.token}` },
      data: {
        xp: 75,
        completed: Object.fromEntries(done.map((id) => [id, 1])),
        streak: 0,
        lastActiveDate: null,
        xpToday: 0,
        hearts: 5,
        heartsUpdatedAt: Date.now(),
      },
    });
    expect(put.status()).toBe(200);

    await recordSpeech(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'כבר יש לי חשבון' }).click();
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה').fill('password123');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.locator('.account-info h2')).toHaveText('מכשיר חדש');
    // It used to stay empty: the store was marked as seeded at start-up, before the progress arrived.
    await expect.poll(async () => Object.keys((await localSrs(page))?.items ?? {}).length).toBe(41);
  });

  test('regression: resetting progress also forgets the review items, so the review button is disabled', async ({
    page,
  }) => {
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await seedSrs(page, L1.words.map(wordKey));
    await page.goto('/');
    await expect(page.locator('.review-card')).toBeVisible();
    await tab(page, 'פרופיל');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'איפוס התקדמות' }).click();
    await page.getByRole('button', { name: 'בואו נתחיל' }).click();
    await page.getByRole('button', { name: 'המשך' }).click();
    await tab(page, 'לימוד');
    await expect(page.locator('.path')).toBeVisible();
    // US-R1 AC4 after a reset: it used to offer "🧠 חזרה (5)" for words of a lesson that is no longer done.
    await expect(page.locator('.practice-btn')).toBeDisabled();
    await expect(page.locator('.review-card')).toHaveCount(0);
    expect((await localSrs(page))?.items).toEqual({});
  });
});

test.describe('v2 analytics and sign-up offer (US-T1, US-S1)', () => {
  test('US-T1 AC4: turning the profile switch off empties the queue and nothing is added until it is on', async ({
    page,
  }) => {
    await page.route('**/api/events', (route) => route.abort('connectionrefused'));
    await openFresh(page);
    expect((await queuedEvents(page))?.length ?? 0).toBeGreaterThan(0);

    await tab(page, 'פרופיל');
    const toggle = page.getByRole('switch', { name: 'שליחת נתוני שימוש אנונימיים' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await queuedEvents(page)).toBeNull();

    await tab(page, 'לימוד');
    await openLesson(page, 'u1l1');
    await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();
    await page.reload();
    await expect(page.locator('.path')).toBeVisible();
    expect(await queuedEvents(page)).toBeNull();

    await tab(page, 'פרופיל');
    await page.getByRole('switch', { name: 'שליחת נתוני שימוש אנונימיים' }).click();
    await tab(page, 'לימוד');
    await openLesson(page, 'u1l1');
    await expect.poll(async () => (await queuedEvents(page))?.map((e) => e.name)).toContain('lesson_start');
  });

  test('US-S1 AC4: no offer after a review, even when the first-lesson offer is due', async ({ page }) => {
    await recordSpeech(page);
    await seedProgress(page, { completed: { u1l1: 1 }, xp: 15 });
    await page.goto('/');
    await page.locator('.practice-btn').click();
    await finishLesson(page, lessonsThrough('u1l1'));
    await expect(page.locator('.lesson-complete h2')).toBeVisible();
    await expect(page.locator('.signup-prompt')).toHaveCount(0);
  });

  test('US-S1 AC4: no offer for a signed-in learner after the first lesson', async ({ page }) => {
    const res = await page.request.post('/api/auth/register', {
      data: { email: uniqueEmail(), password: 'password123', displayName: 'מחובר' },
    });
    const auth = await res.json();
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('e2e-auth')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('e2e-auth', '1');
        }
      },
      [AUTH_KEY, JSON.stringify(auth)] as const,
    );
    await recordSpeech(page);
    await seedProgress(page, {});
    await page.goto('/');
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    await expect(page.locator('.lesson-complete h2')).toHaveText('השיעור הושלם!');
    await expect(page.locator('.signup-prompt')).toHaveCount(0);
  });
});
