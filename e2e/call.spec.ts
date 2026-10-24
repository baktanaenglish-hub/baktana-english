import { expect, test, type Page } from '@playwright/test';
import type { CallStatusResponse, CallTurnRequest, CallTurnResponse } from '../shared/call';
import { AUTH_KEY, openFresh, recordSpeech, seedProgress } from './helpers';

/**
 * AI video call: the status and turn endpoints are mocked, and the learner types (recordSpeech()
 * hides speech recognition, so the keyboard fallback is shown). Calls need a signed-in premium
 * account: the learner registers on the e2e server and the status says whether they're premium.
 */

const SHOTS = process.env.CALL_SHOTS_DIR;

/**
 * One account per worker: the e2e server allows 20 registrations per 15 minutes across the
 * whole suite, and the call endpoints are mocked anyway.
 */
let account: { token: string } | undefined;

/**
 * Opens the app signed in, with GET /api/call/status answering `status` (mutate it to change the
 * next answer).
 */
async function openSignedIn(page: Page, status: CallStatusResponse) {
  if (!account) {
    const res = await page.request.post('/api/auth/register', {
      data: { email: `call-${Date.now()}@example.com`, password: 'password123', displayName: 'מתקשרת' },
    });
    expect(res.status()).toBe(201);
    account = await res.json();
  }
  const auth = account!;
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-auth')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-auth', '1');
      }
    },
    [AUTH_KEY, JSON.stringify(auth)] as const,
  );
  const statusAuth: (string | undefined)[] = [];
  await page.route('**/api/call/status', async (route) => {
    statusAuth.push(route.request().headers().authorization);
    await route.fulfill({ json: status });
  });
  await seedProgress(page, {});
  await recordSpeech(page);
  await page.goto('/');
  await expect(page.locator('.path')).toBeVisible();
  return { token: auth.token as string, statusAuth };
}

const premium = (callsToday = 0): CallStatusResponse => ({ premium: true, callsToday, callsPerDay: 10 });

async function openCallTab(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'שיחה' }).click();
  await expect(page.getByText('הדמויות הן בינה מלאכותית, לא אנשים אמיתיים.')).toBeVisible();
}

async function mockTurn(page: Page, respond: (req: CallTurnRequest) => CallTurnResponse) {
  const requests: CallTurnRequest[] = [];
  await page.route('**/api/call/turn', async (route) => {
    const req = route.request().postDataJSON() as CallTurnRequest;
    requests.push(req);
    await route.fulfill({ json: respond(req) });
  });
  return requests;
}

async function callPersona(page: Page, name: string) {
  await openCallTab(page);
  await page
    .locator('.persona-card', { hasText: name })
    .getByRole('button', { name: /התקשרו/ })
    .click();
  await expect(page.locator('.call-screen')).toBeVisible();
  // The character picks up after the ring.
  await expect(page.locator('.call-timer')).toHaveText(/\d\d:\d\d/);
}

async function say(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'כתבו באנגלית' });
  await expect(input).toBeEnabled();
  await input.fill(text);
  await page.getByRole('button', { name: 'שליחה' }).click();
}

test('a premium learner sees the calls left, and the teacher replies and corrects', async ({ page }) => {
  const status = premium(2);
  const { token, statusAuth } = await openSignedIn(page, status);
  const turnAuth: (string | undefined)[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/call/turn')) turnAuth.push(r.headers().authorization);
  });
  const requests = await mockTurn(page, (req) => ({
    callsToday: 3,
    reply: 'Oh nice, you went to the beach! Did you swim?',
    replyHe: 'איזה כיף, הלכת לים! שחית?',
    corrections: [
      { original: req.message, corrected: 'I went to the beach yesterday', explanationHe: 'בעבר אומרים went.' },
    ],
  }));
  await openCallTab(page);
  await expect(page.locator('.calls-left')).toHaveText(/נשארו לכם 8 מתוך 10 שיחות היום/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/premium-picker.png`, fullPage: true });
  expect(statusAuth[0]).toBe(`Bearer ${token}`);

  await callPersona(page, 'Emma');
  await expect(page.locator('.caption.them')).toContainText("I'm Emma");

  await say(page, 'I go to the beach yesterday');
  await expect(page.locator('.caption.them')).toContainText('Did you swim?');
  const correction = page.locator('.caption-corrections');
  await expect(correction.locator('del')).toHaveText('I go to the beach yesterday');
  await expect(correction.locator('ins')).toHaveText('I went to the beach yesterday');
  await expect(correction).toContainText('בעבר אומרים went.');

  expect(requests[0]).toMatchObject({ persona: 'teacher', message: 'I go to the beach yesterday' });
  expect(turnAuth[0]).toBe(`Bearer ${token}`);
  expect(requests[0].history).toEqual([
    { role: 'assistant', text: "Hi! I'm Emma, your English teacher. How are you today?" },
  ]);

  await page.getByRole('button', { name: 'תרגום' }).click();
  await expect(page.locator('.caption-he')).toHaveText('איזה כיף, הלכת לים! שחית?');

  await page.getByRole('button', { name: 'ניתוק השיחה' }).click();
  const summary = page.locator('.call-summary');
  await expect(summary.getByRole('heading', { level: 1 })).toContainText('Emma');
  await expect(summary.locator('.call-stat').nth(1)).toContainText('1');
  await expect(summary.getByRole('heading', { name: /מה למדנו/ })).toBeVisible();
  await expect(summary.locator('.call-learned ins')).toHaveText('I went to the beach yesterday');

  // Back on the picker, the count includes this call.
  status.callsToday = 3;
  await summary.getByRole('button', { name: 'שיחה חדשה' }).click();
  await expect(page.locator('.persona-grid')).toBeVisible();
  await expect(page.locator('.calls-left')).toHaveText(/נשארו לכם 7 מתוך 10 שיחות היום/);
});

test("the learner picks how picky the teacher is, and it's sent with the turn and remembered", async ({ page }) => {
  await openSignedIn(page, premium());
  const requests = await mockTurn(page, () => ({ reply: 'Nice! What did you do?', replyHe: 'יפה!', corrections: [] }));
  await callPersona(page, 'Emma');
  const levels = page.getByRole('radiogroup', { name: 'מה המורה מתקנת' });
  await expect(levels.getByRole('radio', { name: 'דקדוק' })).toHaveAttribute('aria-checked', 'true');

  await levels.getByRole('radio', { name: 'הכול, גם ניסוח' }).click();
  await expect(levels.getByRole('radio', { name: 'הכול, גם ניסוח' })).toHaveAttribute('aria-checked', 'true');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/correction-level.png` });
  await say(page, 'I did a photo');
  await expect(page.locator('.caption.them')).toContainText('What did you do?');
  expect(requests[0].correctionLevel).toBe('full');

  await levels.getByRole('radio', { name: 'רק טעויות גדולות' }).click();
  await say(page, 'It was fun');
  await expect.poll(() => requests[1]?.correctionLevel).toBe('light');

  // The next call starts with the same choice.
  await page.getByRole('button', { name: 'ניתוק השיחה' }).click();
  await page.locator('.call-summary').getByRole('button', { name: 'שיחה חדשה' }).click();
  await callPersona(page, 'Emma');
  await expect(
    page.getByRole('radiogroup', { name: 'מה המורה מתקנת' }).getByRole('radio', { name: 'רק טעויות גדולות' }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('the friend never shows corrections', async ({ page }) => {
  await openSignedIn(page, premium());
  await mockTurn(page, (req) => ({
    reply: 'Haha, cool! Tell me more.',
    replyHe: 'חחח, מגניב! ספרי עוד.',
    // Even if the server sent some, the friend must not show them.
    corrections: [{ original: req.message, corrected: 'I went', explanationHe: 'x' }],
  }));
  await callPersona(page, 'Maya');
  await say(page, 'I go to party');
  await expect(page.locator('.caption.them')).toContainText('Tell me more.');
  await expect(page.locator('.caption.you')).toContainText('I go to party');
  await expect(page.locator('.caption-corrections')).toHaveCount(0);
  await expect(page.locator('.call-level')).toHaveCount(0);

  await page.getByRole('button', { name: 'ניתוק השיחה' }).click();
  await expect(page.locator('.call-summary')).toBeVisible();
  await expect(page.locator('.call-learned')).toHaveCount(0);
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect(page.locator('.path')).toBeVisible();
});

test('a failed turn shows a Hebrew error and retries', async ({ page }) => {
  await openSignedIn(page, premium());
  let calls = 0;
  await page.route('**/api/call/turn', async (route) => {
    calls++;
    if (calls === 1)
      await route.fulfill({ status: 503, json: { error: 'unavailable', message: 'השיחות לא זמינות כרגע.' } });
    else await route.fulfill({ json: { reply: 'One latte, coming up!', replyHe: 'לאטה אחד, מגיע!', corrections: [] } });
  });
  await callPersona(page, 'Sam');
  await say(page, 'A latte please');
  await expect(page.getByRole('alert')).toContainText('השיחות לא זמינות כרגע.');
  await page.getByRole('button', { name: 'נסו שוב' }).click();
  await expect(page.locator('.caption.them')).toContainText('One latte, coming up!');
});

test('a guest is invited to sign in, and the characters are a teaser', async ({ page }) => {
  await openFresh(page);
  let statusCalls = 0;
  await page.route('**/api/call/status', (route) => {
    statusCalls++;
    return route.abort();
  });
  await openCallTab(page);
  await expect(page.getByText('שיחות וידאו זמינות למנויי פרימיום. התחברו כדי להמשיך')).toBeVisible();
  await expect(page.locator('.persona-call').first()).toBeDisabled();
  expect(statusCalls).toBe(0);
  await page.locator('.call-gate').getByRole('button', { name: 'התחברות' }).click();
  await expect(page.locator('.auth-form')).toBeVisible();
});

test('a signed-in learner without premium sees the locked teaser', async ({ page }) => {
  await openSignedIn(page, { premium: false, callsToday: 0, callsPerDay: 10 });
  await openCallTab(page);
  await expect(page.getByText('🔒 שיחות וידאו הן חלק מפרימיום')).toBeVisible();
  await expect(page.locator('.persona-card')).toHaveCount(4);
  for (const button of await page.locator('.persona-call').all()) await expect(button).toBeDisabled();
  await expect(page.locator('.calls-left')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/premium-locked.png`, fullPage: true });
});

test('the premium screen opens from the call tab; on the website it points to the Play app', async ({ page }) => {
  await openSignedIn(page, { premium: false, callsToday: 0, callsPerDay: 10 });
  await openCallTab(page);
  await page.getByRole('button', { name: '👑 לפרטים על פרימיום' }).click();
  await expect(page.getByRole('heading', { name: /פרימיום/ })).toBeVisible();
  await expect(page.getByText('עד 10 שיחות וידאו ביום', { exact: false })).toBeVisible();
  // Billing is only in the Google Play build: no plans or buy button here.
  await expect(page.getByText('ההצטרפות לפרימיום נעשית באפליקציה', { exact: false })).toBeVisible();
  await expect(page.locator('.paywall-plan')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/paywall-web.png`, fullPage: true });
  await page.getByRole('button', { name: 'חזרה' }).click();
  await expect(page.getByText('🔒 שיחות וידאו הן חלק מפרימיום')).toBeVisible();
});

test('a subscriber sees when premium renews on the profile and the premium screen', async ({ page }) => {
  await openSignedIn(page, { ...premium(), premiumUntil: '2026-11-21T12:00:00.000Z', willRenew: true });
  await expect(page.locator('.top-bar .premium-badge')).toBeVisible();
  await page.locator('.bottom-nav').getByRole('button', { name: 'פרופיל' }).click();
  const card = page.locator('.premium-card');
  await expect(card).toContainText('מתחדש ב־21 בנובמבר 2026');
  await card.getByRole('button', { name: 'פרטי המנוי' }).click();
  await expect(page.getByText('המנוי שלכם פעיל.')).toBeVisible();
  await expect(page.getByText('מתחדש ב־21 בנובמבר 2026')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/paywall-subscriber.png`, fullPage: true });
  await page.getByRole('button', { name: 'לשיחות 📞' }).click();
  await expect(page.locator('.calls-left')).toBeVisible();
});

test('a tester gets one short trial call a day', async ({ page }) => {
  const status: CallStatusResponse = { premium: false, tester: true, callsToday: 0, callsPerDay: 1 };
  await openSignedIn(page, status);
  await openCallTab(page);
  await expect(page.getByText('שיחת ניסיון לבודקים: שיחה אחת ביום, עד 10 משפטים')).toBeVisible();
  await expect(page.locator('.persona-call').first()).toBeEnabled();
  // A tester isn't premium: no badge.
  await expect(page.locator('.top-bar .premium-badge')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tester.png`, fullPage: true });

  status.callsToday = 1;
  await page.locator('.bottom-nav').getByRole('button', { name: 'פרופיל' }).click();
  await openCallTab(page);
  await expect(page.getByText('השיחה של היום כבר נוצלה. נתראה מחר!')).toBeVisible();
  for (const button of await page.locator('.persona-call').all()) await expect(button).toBeDisabled();
});

test('after 10 calls today the characters wait for tomorrow', async ({ page }) => {
  await openSignedIn(page, premium(10));
  await openCallTab(page);
  await expect(page.getByText('הגעתם ל־10 שיחות היום. נתראה מחר!')).toBeVisible();
  for (const button of await page.locator('.persona-call').all()) await expect(button).toBeDisabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/premium-limit.png`, fullPage: true });
});

test('reaching the daily limit mid-call ends it with a Hebrew message', async ({ page }) => {
  const status = premium(9);
  await openSignedIn(page, status);
  await page.route('**/api/call/turn', (route) =>
    route.fulfill({ status: 429, json: { error: 'daily_limit', message: 'הגעתם ל־10 שיחות היום. נתראה מחר! 🌙' } }),
  );
  await expect(page.locator('.path')).toBeVisible();
  await callPersona(page, 'Daniel');
  await say(page, 'Hello, my name is Noa');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('הגעתם ל־10 שיחות היום');
  await expect(alert.getByRole('button', { name: 'נסו שוב' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'כתבו באנגלית' })).toBeDisabled();

  status.callsToday = 10;
  await alert.getByRole('button', { name: 'חזרה לדמויות' }).click();
  await expect(page.getByText('הגעתם ל־10 שיחות היום. נתראה מחר!')).toBeVisible();
});

test('a status that fails to load can be retried', async ({ page }) => {
  await openSignedIn(page, premium());
  let fail = true;
  await page.route('**/api/call/status', (route) =>
    fail ? route.abort('internetdisconnected') : route.fulfill({ json: premium(1) }),
  );
  await openCallTab(page);
  await expect(page.getByRole('alert')).toContainText('אין חיבור לשרת');
  fail = false;
  await page.getByRole('button', { name: 'נסו שוב' }).click();
  await expect(page.locator('.calls-left')).toHaveText(/נשארו לכם 9 מתוך 10/);
});
