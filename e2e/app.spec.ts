/**
 * End-to-end acceptance tests (docs/user-stories.md). Each test names the
 * criteria it covers. The API runs with an in-memory database (see playwright.config.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { allLessons } from '../src/data/course';
import type { Lesson } from '../src/types';
import {
  AUTH_KEY,
  PROGRESS_KEY,
  answer,
  finishLesson,
  lesson,
  lessonButton,
  localProgress,
  next,
  openFresh,
  openLesson,
  recordSpeech,
  seedProgress,
  token,
} from './helpers';

const L1 = lesson('u1l1');
const L2 = lesson('u1l2');
const topBar = (page: Page) => page.locator('.top-bar');
let counter = 0;
const uniqueEmail = () => `e2e-${Date.now()}-${counter++}@example.com`;

async function apiMe(page: Page) {
  const t = await token(page);
  const res = await page.request.get('/api/me', { headers: { Authorization: `Bearer ${t}` } });
  expect(res.status()).toBe(200);
  return (await res.json()) as {
    user: { displayName: string };
    progress: { xp: number; completed: Record<string, number> };
  };
}

async function register(page: Page, name: string, email = uniqueEmail()) {
  await page.getByLabel('שם תצוגה').fill(name);
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('password123');
  await page.getByRole('button', { name: 'יצירת חשבון' }).click();
  await expect(page.locator('.account-info h2')).toHaveText(name);
  return email;
}

async function tab(page: Page, name: 'לימוד' | 'ליגה' | 'פרופיל') {
  await page.locator('.bottom-nav').getByRole('button', { name }).click();
}

const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
};

test('US-G1, US-L6, US-L7, US-G2, US-D2: a guest finishes the first lesson and the next one unlocks', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await recordSpeech(page);
  await page.goto('/');

  // US-D2 AC1: onboarding first, no sign-up required.
  await expect(page.getByRole('button', { name: 'בואו נתחיל' })).toBeVisible();
  await page.getByRole('button', { name: 'בואו נתחיל' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();

  // US-G1 AC1/AC2/AC4
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(topBar(page)).toContainText('🔥 0');
  await expect(topBar(page)).toContainText('⭐ 0');
  await expect(topBar(page)).toContainText('❤️ 5');
  await expect(lessonButton(page, 'u1l1')).toBeEnabled();
  await expect(page.locator('.lesson-node.has-label')).toContainText(L1.title);
  await expect(page.locator('.start-label')).toHaveText('התחילו!');
  for (const other of allLessons.slice(1)) {
    await expect(lessonButton(page, other.id)).toBeDisabled();
    await expect(lessonButton(page, other.id)).toHaveAttribute('aria-label', /\(נעול\)/);
  }

  // US-G1 AC3: the lesson opens without asking to sign in.
  await openLesson(page, 'u1l1');
  await expect(page.locator('.lesson-header')).toBeVisible();
  // US-G1 AC4: English prompts are LTR inside the RTL page.
  const englishPrompt = page.locator('.prompt-word[dir=ltr], .option[dir=ltr]').first();
  await expect(englishPrompt).toBeVisible();

  const seen = await finishLesson(page, L1);
  expect(seen).toHaveLength(12); // US-L1 AC1: 5 words, 3 sentences → 12

  // US-L6 AC1
  await expect(page.locator('.stat-card.xp')).toContainText('+15');
  await expect(page.locator('.stat-card.accuracy')).toContainText('100%');
  await page.getByRole('button', { name: 'המשך' }).click();

  // US-L6 AC3
  await expect(lessonButton(page, 'u1l1')).toHaveAttribute('aria-label', /\(הושלם\)/);
  await expect(lessonButton(page, 'u1l2')).toBeEnabled();
  await expect(page.locator('.lesson-node.has-label')).toContainText(L2.title);
  await expect(topBar(page)).toContainText('⭐ 15');
  await expect(topBar(page)).toContainText('🔥 1');

  // US-G2 AC1 + US-D2 AC2: a reload keeps progress and skips onboarding.
  await page.reload();
  await expect(lessonButton(page, 'u1l1')).toHaveAttribute('aria-label', /\(הושלם\)/);
  await expect(topBar(page)).toContainText('⭐ 15');
  expect((await localProgress(page)).completed).toEqual({ u1l1: 1 });
  expect(errors).toEqual([]);
});

test('US-H1, US-L5, US-L6 AC2: a wrong answer costs a heart and the exercise comes back', async ({ page }) => {
  await openFresh(page);
  await openLesson(page, 'u1l1');

  const progressBar = page.getByRole('progressbar', { name: 'התקדמות בשיעור' });
  const missed = await answer(page, L1, false);
  // US-L2 AC3 + US-H1 AC1
  const bar = page.locator('.lesson-footer.feedback.bad');
  await expect(bar).toContainText('לא בדיוק…');
  await expect(bar).toContainText('התשובה הנכונה:');
  await expect(page.locator('.lesson-header .hearts')).toContainText('❤️ 4');
  await expect(progressBar).toHaveAttribute('aria-valuenow', '0'); // US-L5 AC3
  await next(page);

  const rest = await finishLesson(page, L1);
  // US-L5 AC1/AC2: 11 remaining + the missed one again, at the end of the queue.
  expect(rest).toHaveLength(12);
  expect(rest.at(-1)).toBe(missed);

  await expect(page.locator('.stat-card.xp')).toContainText('+10');
  await expect(page.locator('.stat-card.accuracy')).toContainText(`${Math.round((12 / 13) * 100)}%`);
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(topBar(page)).toContainText('❤️ 4');

  // US-H2 AC4: the profile shows when the next heart arrives.
  await tab(page, 'פרופיל');
  await expect(page.locator('.profile')).toContainText(/לב הבא בעוד (29|30) דק׳/);
});

test('US-H3: running out of hearts shows the out-of-hearts screen', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { hearts: 1, heartsUpdatedAt: Date.now() });
  await page.goto('/');
  await openLesson(page, 'u1l1');

  await answer(page, L1, false);
  // AC1: the red feedback comes first, then the screen.
  await expect(page.locator('.lesson-footer.feedback.bad')).toBeVisible();
  await next(page);
  await expect(page.getByRole('heading', { name: 'נגמרו הלבבות' })).toBeVisible();
  await expect(page.locator('.out-of-hearts')).toContainText('💔');
  await expect(page.locator('.out-of-hearts')).toContainText('לב חדש מתמלא כל 30 דקות');
  await page.getByRole('button', { name: 'חזרה למסלול' }).click();

  // AC3: nothing from the interrupted lesson is saved.
  await expect(lessonButton(page, 'u1l1')).not.toHaveAttribute('aria-label', /\(הושלם\)/);
  await expect(topBar(page)).toContainText('❤️ 0');
  expect((await localProgress(page)).xp).toBe(0);

  // AC2: with 0 hearts a lesson opens straight on that screen.
  await lessonButton(page, 'u1l1').click();
  await expect(page.getByRole('heading', { name: 'נגמרו הלבבות' })).toBeVisible();
});

test('US-A1, US-A3, US-A4, US-A2, US-P2: register → progress synced → reload keeps it → other device', async ({
  page,
  browser,
}) => {
  const errors = pageErrors(page);
  await openFresh(page);
  await openLesson(page, 'u1l1');
  await finishLesson(page, L1);
  await page.getByRole('button', { name: 'המשך' }).click();

  // US-A1 AC1 + US-A3 AC1: the guest's lesson reaches the account.
  await tab(page, 'פרופיל');
  await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
  const email = await register(page, 'רותם');
  await expect(page.locator('.sync-status')).toContainText('מסונכרנת');
  let me = await apiMe(page);
  expect(me.progress).toMatchObject({ xp: 15, completed: { u1l1: 1 } });

  // US-A4 AC1: a lesson finished while signed in is reported.
  await tab(page, 'לימוד');
  await openLesson(page, 'u1l2');
  await finishLesson(page, L2);
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect.poll(async () => (await apiMe(page)).progress.completed).toEqual({ u1l1: 1, u1l2: 1 });
  me = await apiMe(page);
  expect(me.progress.xp).toBe(30);

  // US-P2 / US-R4 AC2 + regression: review XP (+10) is uploaded right away (it used to send the stale state).
  await page.getByRole('button', { name: /תרגול/ }).click();
  const both: Lesson = { ...L1, words: [...L1.words, ...L2.words], sentences: [...L1.sentences, ...L2.sentences] };
  await finishLesson(page, both);
  // With nothing due the session is built from upcoming items (or random practice before SRS data).
  await expect(page.locator('.lesson-complete h2')).toHaveText(/^(התרגול הושלם|החזרה הושלמה)!$/);
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(topBar(page)).toContainText('⭐ 40');
  await expect.poll(async () => (await apiMe(page)).progress.xp).toBe(40);
  expect((await apiMe(page)).progress.completed).toEqual({ u1l1: 1, u1l2: 1 }); // US-P2 AC2

  // US-A2 AC3: still signed in after a reload, with the same progress.
  await page.reload();
  await tab(page, 'פרופיל');
  await expect(page.locator('.account-info h2')).toHaveText('רותם');
  await tab(page, 'לימוד');
  await expect(lessonButton(page, 'u1l2')).toHaveAttribute('aria-label', /\(הושלם\)/);
  await expect(topBar(page)).toContainText('⭐ 40');

  // US-A2 AC1 + US-A3 AC3 + US-A4 AC3: logging in on another device brings the progress along.
  const other = await browser.newContext({ locale: 'he-IL', viewport: { width: 420, height: 860 } });
  const device = await other.newPage();
  await recordSpeech(device);
  await device.goto('/');
  await device.getByRole('button', { name: 'כבר יש לי חשבון' }).click();
  await device.getByLabel('אימייל').fill(email.toUpperCase()); // US-A1 AC4
  await device.getByLabel('סיסמה').fill('password123');
  await device.getByRole('button', { name: 'כניסה' }).click();
  await expect(device.locator('.account-info h2')).toHaveText('רותם');
  await tab(device, 'לימוד');
  await expect(lessonButton(device, 'u1l2')).toHaveAttribute('aria-label', /\(הושלם\)/);
  await expect(lessonButton(device, 'u1l3')).toBeEnabled();
  await expect(topBar(device)).toContainText('⭐ 40');

  // US-A2 AC5: signing out removes the token but keeps local progress.
  await tab(device, 'פרופיל');
  await device.getByRole('button', { name: 'התנתקות' }).click();
  await expect(device.locator('.account-info h2')).toHaveText('אורח/ת');
  expect(await device.evaluate((k) => localStorage.getItem(k), AUTH_KEY)).toBeNull();
  expect((await localProgress(device)).xp).toBe(40);
  await other.close();
  expect(errors).toEqual([]);
});

test('store requirement: a learner deletes their account from the profile', async ({ page }) => {
  await openFresh(page);
  await tab(page, 'פרופיל');
  await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
  await expect(page.getByRole('link', { name: 'מדיניות הפרטיות' })).toHaveAttribute('href', /privacy\.html$/);
  const email = await register(page, 'למחיקה');

  await page.getByRole('button', { name: 'מחיקת החשבון' }).click();
  await page.getByLabel('הסיסמה שלך, לאישור').fill('wrong-password');
  await page.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
  await expect(page.getByRole('alert')).toContainText('הסיסמה שגויה');
  expect(await token(page)).not.toBeNull();

  await page.getByLabel('הסיסמה שלך, לאישור').fill('password123');
  await page.getByRole('button', { name: 'מחיקה לצמיתות' }).click();
  await expect(page.locator('.account-info h2')).toHaveText('אורח/ת');
  expect(await token(page)).toBeNull();
  const login = await page.request.post('/api/auth/login', { data: { email, password: 'password123' } });
  expect(login.status()).toBe(401);
});

test('US-A1 AC2, US-A2 AC2: duplicate email and wrong password show Hebrew errors', async ({ page }) => {
  const email = uniqueEmail();
  const res = await page.request.post('/api/auth/register', {
    data: { email, password: 'password123', displayName: 'כפיל' },
  });
  expect(res.status()).toBe(201);

  await openFresh(page);
  await tab(page, 'פרופיל');
  await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
  await page.getByLabel('שם תצוגה').fill('כפיל');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('password123');
  await page.getByRole('button', { name: 'יצירת חשבון' }).click();
  await expect(page.getByRole('alert')).toContainText('כבר קיים חשבון');

  await page.getByRole('button', { name: /התחברות$/ }).click();
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('wrong-password');
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toContainText('האימייל או הסיסמה שגויים');
  expect(await token(page)).toBeNull();
});

test('US-B1: the leaderboard shows the signed-in learner, and guests see it with an invitation', async ({ page }) => {
  await openFresh(page);
  // AC5: guests can look.
  await tab(page, 'ליגה');
  await expect(page.getByRole('heading', { name: /הליגה השבועית/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'יצירת פרופיל' })).toBeVisible();
  await expect(page.locator('.board[aria-busy]')).toHaveCount(0);

  await page.getByRole('button', { name: 'יצירת פרופיל' }).click();
  await register(page, 'ליגה טסט');
  await tab(page, 'לימוד');
  await openLesson(page, 'u1l1');
  await finishLesson(page, L1);
  await page.getByRole('button', { name: 'המשך' }).click();

  // AC1/AC3: our row is listed with our XP and highlighted.
  await tab(page, 'ליגה');
  const mine = page.locator('.board-row.me');
  await expect(mine).toContainText('ליגה טסט');
  await expect(mine).toContainText('(אני)');
  await expect(mine).toContainText('15 XP');
  const xps = (await page.locator('.board-xp').allTextContents()).map((t) => parseInt(t, 10));
  expect(xps).toEqual([...xps].sort((a, b) => b - a));
  // AC4: no e-mail addresses on the board.
  await expect(page.locator('.board')).not.toContainText('@');
});

test.describe('server unavailable', () => {
  test('US-O1, US-B1 AC6, US-O2 AC3: guests learn normally when the API is down', async ({ page }) => {
    const errors = pageErrors(page);
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));
    await openFresh(page);
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(lessonButton(page, 'u1l2')).toBeEnabled();

    await tab(page, 'ליגה');
    await expect(page.locator('.leaderboard')).toContainText('אין חיבור לשרת');
    await expect(page.getByRole('button', { name: 'נסו שוב' })).toBeVisible();

    await tab(page, 'פרופיל');
    await expect(page.locator('.profile')).toContainText('⭐ 15');
    await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
    await page.getByLabel('שם תצוגה').fill('אופליין');
    await page.getByLabel('אימייל').fill(uniqueEmail());
    await page.getByLabel('סיסמה').fill('password123');
    await page.getByRole('button', { name: 'יצירת חשבון' }).click();
    await expect(page.getByRole('alert')).toContainText('אין חיבור לשרת');
    expect(await token(page)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('the dev proxy answering 502 counts as offline too', async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ status: 502, body: 'Bad gateway' }));
    await openFresh(page);
    await tab(page, 'ליגה');
    await expect(page.locator('.leaderboard')).toContainText('אין חיבור לשרת');
  });

  test('US-O2 AC1/AC2: a signed-in learner keeps learning offline and syncs when back', async ({ page }) => {
    const email = uniqueEmail();
    const res = await page.request.post('/api/auth/register', {
      data: { email, password: 'password123', displayName: 'נוסע' },
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
    await seedProgress(page, {});
    await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
    await recordSpeech(page);
    await page.goto('/');

    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    await page.getByRole('button', { name: 'המשך' }).click();
    await tab(page, 'פרופיל');
    await expect(page.locator('.sync-status')).toContainText('אין חיבור');
    expect((await localProgress(page)).completed).toEqual({ u1l1: 1 });

    // Back online: the "sync now" button (or the next load) uploads the local progress.
    await page.unroute('**/api/**');
    await page.getByRole('button', { name: 'סנכרון עכשיו' }).click();
    await expect(page.locator('.sync-status')).toContainText('מסונכרנת');
    const me = await page.request.get('/api/me', { headers: { Authorization: `Bearer ${auth.token}` } });
    expect((await me.json()).progress).toMatchObject({ xp: 15, completed: { u1l1: 1 } });
  });
});

test('US-G2 AC2: corrupt saved data does not break the app', async ({ page }) => {
  const errors = pageErrors(page);
  await page.addInitScript((key) => localStorage.setItem(key, '{not json'), PROGRESS_KEY);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'בואו נתחיל' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('US-G2 AC3: resetting progress asks first', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { xp: 25, completed: { u1l1: 1 }, streak: 1 });
  await page.goto('/');
  await tab(page, 'פרופיל');

  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'איפוס התקדמות' }).click();
  await expect(page.locator('.profile')).toContainText('⭐ 25');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'איפוס התקדמות' }).click();
  // Back to a brand-new state, which starts with onboarding again.
  await expect(page.getByRole('button', { name: 'בואו נתחיל' })).toBeVisible();
  expect((await localProgress(page)).xp).toBe(0);
});

test.describe('v2 (docs/spec/v2.md §9)', () => {
  test('US-I1: the unit intro opens before the first lesson, once; 📖 reopens it; level chips', async ({ page }) => {
    const errors = pageErrors(page);
    await openFresh(page);
    // AC5: every unit banner shows its CEFR level.
    await expect(page.locator('.unit-banner .level-chip')).toHaveCount(await page.locator('.unit-banner').count());
    await expect(page.locator('.unit-banner').first().locator('.level-chip')).toHaveText('Pre-A1');

    // AC1: title, goals and the tip, with English isolated left-to-right (AC4).
    await lessonButton(page, 'u1l1').click();
    const intro = page.getByRole('dialog');
    await expect(intro).toContainText('יחידה 1');
    await expect(intro.locator('.intro-goals li').first()).toBeVisible();
    await expect(intro.locator('.rich-tip bdi[dir=ltr][lang=en]').first()).toHaveText('am / is / are');
    await intro.getByRole('button', { name: 'יאללה, מתחילים' }).click();
    await expect(page.locator('.lesson-header')).toBeVisible();
    await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();

    // AC2: not again for the same unit.
    await lessonButton(page, 'u1l1').click();
    await expect(page.locator('.lesson-header')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();

    // AC3: 📖 shows it any time without starting a lesson.
    await page
      .locator('.unit-banner')
      .first()
      .getByRole('button', { name: /טיפ פתיחה/ })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'הבנתי' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.path')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('US-S1 AC1/AC3: a guest is offered an account after the first lesson; "maybe later" hides it', async ({
    page,
  }) => {
    await openFresh(page);
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    const card = page.locator('.signup-prompt');
    await expect(card).toContainText('שמרו את ההתקדמות שלכם');
    await expect(card).toContainText('חשבון חינמי שומר את ה־XP והרצף בכל מכשיר');
    await card.getByRole('button', { name: 'אולי אחר כך' }).click();
    await expect(card).toHaveCount(0);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('baktana-english:signup-prompt:v1') ?? '{}'),
    );
    expect(stored.dismissCount).toBe(1);
    await page.getByRole('button', { name: 'המשך' }).click();

    // Lessons 2–4: no card.
    await openLesson(page, 'u1l2');
    await finishLesson(page, L2);
    await expect(page.locator('.lesson-complete h2')).toHaveText('השיעור הושלם!');
    await expect(page.locator('.signup-prompt')).toHaveCount(0);
  });

  test('US-S1 AC2: "הרשמה" opens sign-up and returns to the path afterwards', async ({ page }) => {
    await openFresh(page);
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    await page.locator('.signup-prompt').getByRole('button', { name: 'הרשמה' }).click();
    await page.getByLabel('שם תצוגה').fill('מהכרטיס');
    await page.getByLabel('אימייל').fill(uniqueEmail());
    await page.getByLabel('סיסמה').fill('password123');
    await page.getByRole('button', { name: 'יצירת חשבון' }).click();
    await expect(page.locator('.path')).toBeVisible();
    expect(await token(page)).not.toBeNull();
  });

  test('US-R1 AC4: the review button is disabled before the first lesson', async ({ page }) => {
    await openFresh(page);
    await expect(page.locator('.practice-btn')).toBeDisabled();
    await expect(page.locator('.review-card')).toHaveCount(0);
  });

  test('US-R4 AC1/AC2: a review opens with 0 hearts, a mistake costs nothing, +10 XP', async ({ page }) => {
    await recordSpeech(page);
    await seedProgress(page, { hearts: 0, heartsUpdatedAt: Date.now(), completed: { u1l1: 1 }, xp: 15 });
    await page.goto('/');
    await page.locator('.practice-btn').click();
    await expect(page.locator('.lesson-header .practice-badge')).toContainText('חזרה');
    await answer(page, L1, false);
    await expect(page.locator('.lesson-footer.feedback.bad')).toBeVisible();
    await next(page);
    await finishLesson(page, L1);
    await expect(page.locator('.stat-card.xp')).toContainText('+10');
    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(topBar(page)).toContainText('❤️ 0');
    await expect(topBar(page)).toContainText('⭐ 25');
    expect((await localProgress(page)).completed).toEqual({ u1l1: 1 });
  });

  test('US-T1 AC1/AC2: a lesson queues lesson_start, one exercise_answer per exercise, lesson_complete', async ({
    page,
  }) => {
    await page.route('**/api/events', (route) => route.abort('connectionrefused'));
    await openFresh(page);
    await openLesson(page, 'u1l1');
    await finishLesson(page, L1);
    const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('baktana-english:events:v1') ?? 'null'));
    expect(Array.isArray(queue)).toBe(true);
    const names = (queue as { name: string }[])
      .map((e) => e.name)
      .filter((n) => n.startsWith('lesson_') || n === 'exercise_answer');
    expect(names[0]).toBe('lesson_start');
    expect(names.at(-1)).toBe('lesson_complete');
    expect(names.filter((n) => n === 'exercise_answer')).toHaveLength(12);
    expect(JSON.stringify(queue)).not.toMatch(/@|password/);
  });

  test('US-U1 AC3: progress from the 16-lesson course – done ✓, u4l3 current, catch-up lessons open with "חדש!"', async ({
    page,
  }) => {
    const old = ['u1l1', 'u1l2', 'u1l3', 'u2l1', 'u2l2', 'u3l1', 'u3l2', 'u4l1', 'u4l2'];
    await recordSpeech(page);
    await seedProgress(page, { completed: Object.fromEntries(old.map((id) => [id, 1])), xp: 120 });
    await page.goto('/');
    await expect(page.locator('.path')).toBeVisible();
    for (const id of old) await expect(lessonButton(page, id)).toHaveAttribute('aria-label', /\(הושלם\)/);
    await expect(page.locator('.lesson-node.has-label')).toContainText(lesson('u4l3').title);
    for (const id of ['u1l4', 'u1l5', 'u2l3', 'u2l4', 'u2l5', 'u3l3', 'u3l4', 'u3l5']) {
      await expect(lessonButton(page, id)).toBeEnabled();
      await expect(lessonButton(page, id)).toHaveAttribute('aria-label', /\(חדש!\)/);
    }
    await expect(lessonButton(page, 'u4l4')).toBeDisabled();
  });
});
