/**
 * Resetting progress while signed in (US-A5): the reset reaches the account, and another
 * device that still holds the old progress adopts the reset instead of restoring it.
 */
import { expect, test, type Page } from '@playwright/test';
import { finishLesson, lesson, localProgress, openFresh, openLesson, recordSpeech, token } from './helpers';

const L1 = lesson('u1l1');

async function tab(page: Page, name: 'לימוד' | 'פרופיל') {
  await page.locator('.bottom-nav').getByRole('button', { name }).click();
}

async function serverProgress(page: Page) {
  const res = await page.request.get('/api/progress', { headers: { Authorization: `Bearer ${await token(page)}` } });
  return (await res.json()).progress as { xp: number; completed: Record<string, number> };
}

test('a signed-in reset clears the account and the other device', async ({ page, browser }) => {
  const email = `e2e-reset-${Date.now()}@example.com`;
  await openFresh(page);
  await tab(page, 'פרופיל');
  await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
  await page.getByLabel('שם תצוגה').fill('נועה');
  await page.getByLabel('אימייל').fill(email);
  await page.getByLabel('סיסמה').fill('password123');
  await page.getByRole('button', { name: 'יצירת חשבון' }).click();
  await expect(page.locator('.account-info h2')).toHaveText('נועה');
  await tab(page, 'לימוד');
  await openLesson(page, L1.id);
  await finishLesson(page, L1);
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect.poll(async () => (await serverProgress(page)).completed).toEqual({ u1l1: 1 });

  // A second device signs in and gets the progress.
  const other = await browser.newContext({ locale: 'he-IL' });
  const device = await other.newPage();
  await recordSpeech(device);
  await device.goto('/');
  await device.getByRole('button', { name: 'כבר יש לי חשבון' }).click();
  await device.getByLabel('אימייל').fill(email);
  await device.getByLabel('סיסמה').fill('password123');
  await device.getByRole('button', { name: 'כניסה' }).click();
  await expect(device.locator('.account-info h2')).toHaveText('נועה');
  await expect.poll(async () => (await localProgress(device)).completed).toEqual({ u1l1: 1 });

  // Reset on the first device.
  await tab(page, 'פרופיל');
  page.once('dialog', (d) => {
    expect(d.message()).toContain('גם בחשבון');
    void d.accept();
  });
  await page.getByRole('button', { name: 'איפוס התקדמות' }).click();
  await expect.poll(async () => (await serverProgress(page)).completed).toEqual({});
  expect((await localProgress(page)).completed).toEqual({});

  // The second device opens again with its old copy: it adopts the reset, and the account stays empty.
  await device.reload();
  await expect.poll(async () => (await localProgress(device)).completed).toEqual({});
  expect((await localProgress(device)).xp).toBe(0);
  expect((await serverProgress(page)).completed).toEqual({});
  await other.close();
});
