/**
 * What a new learner meets in the first days: new words shown before they are asked, a question
 * before leaving a lesson half-way, the Android back button, locked lessons that say why, the
 * placement test from the onboarding, and the league's invitation for guests.
 */
import { expect, test, type Page } from '@playwright/test';
import { answer, lesson, lessonButton, next, openFresh, openLesson, recordSpeech, seedProgress } from './helpers';

const L1 = lesson('u1l1');

/** Presses the Android back button (src/lib/back.ts); false when the app would go to the background. */
const back = (page: Page) => page.evaluate(() => (window as unknown as { __back: () => boolean }).__back());

test('a new word is shown with its translation the first time, not on a replay', async ({ page }) => {
  await openFresh(page);
  await openLesson(page, 'u1l1');
  const card = page.locator('.new-word');
  await expect(card).toContainText('מילה חדשה');
  const prompt = (await page.locator('.prompt-word').textContent())!.trim();
  const word = L1.words.find((w) => w.he === prompt || w.en === prompt)!;
  await expect(card).toContainText(word.en);
  await expect(card).toContainText(word.he);

  // After checking, the right option is green.
  await answer(page, L1);
  await expect(page.locator('.option.correct')).toHaveCount(1);
});

test('a wrong pick turns red and the right answer green', async ({ page }) => {
  await openFresh(page);
  await openLesson(page, 'u1l1');
  await answer(page, L1, false);
  await expect(page.locator('.option.wrong')).toHaveCount(1);
  await expect(page.locator('.option.correct')).toHaveCount(1);
});

test('words answered before are not new any more', async ({ page }) => {
  await openFresh(page);
  await openLesson(page, 'u1l1');
  for (let i = 0; i < 40 && !(await page.locator('.lesson-complete').isVisible()); i++) {
    await answer(page, L1);
    await next(page);
    await expect(page.locator('.lesson-complete, .lesson-body').first()).toBeVisible();
  }
  await page.getByRole('button', { name: 'המשך' }).click();
  await openLesson(page, 'u1l1');
  await expect(page.locator('.exercise-title')).toBeVisible();
  await expect(page.locator('.new-word')).toHaveCount(0);
});

test('leaving a lesson half-way asks first; the back button does the same', async ({ page }) => {
  await openFresh(page);
  await openLesson(page, 'u1l1');

  // Nothing answered yet: ✕ leaves at once.
  await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();
  await expect(page.locator('.path')).toBeVisible();

  await openLesson(page, 'u1l1');
  await answer(page, L1);
  await next(page);
  await page.getByRole('button', { name: 'יציאה מהשיעור' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'לצאת מהשיעור?' });
  await expect(dialog).toContainText('ההתקדמות בשיעור הזה לא תישמר');
  await dialog.getByRole('button', { name: 'ממשיכים ללמוד' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.lesson-header')).toBeVisible();

  // Back opens the question, back again closes it, and "יציאה" leaves.
  expect(await back(page)).toBe(true);
  await expect(dialog).toBeVisible();
  expect(await back(page)).toBe(true);
  await expect(dialog).toHaveCount(0);
  expect(await back(page)).toBe(true);
  await dialog.getByRole('button', { name: 'יציאה' }).click();
  await expect(page.locator('.path')).toBeVisible();
});

test('the back button goes back to the path, and leaves the app from there', async ({ page }) => {
  await openFresh(page);
  await page.locator('.bottom-nav').getByRole('button', { name: 'פרופיל' }).click();
  await expect(page.locator('.path')).toHaveCount(0);
  expect(await back(page)).toBe(true);
  await expect(page.locator('.path')).toBeVisible();

  // The unit sheet closes first.
  await page
    .getByRole('button', { name: /טיפ פתיחה/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await back(page)).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  expect(await back(page)).toBe(false);
});

test('a locked lesson says what opens it', async ({ page }) => {
  await openFresh(page);
  await expect(lessonButton(page, 'u1l2')).toBeDisabled();
  await lessonButton(page, 'u1l2').click({ force: true });
  await expect(page.locator('.path-toast')).toContainText(`סיימו קודם את "${L1.title}"`);
  await expect(page.locator('.lesson-header')).toHaveCount(0);
});

test('"I know some English" in the onboarding starts the placement test', async ({ page }) => {
  await recordSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'בואו נתחיל' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page.getByRole('heading', { name: 'כמה אנגלית אתם כבר יודעים?' })).toBeVisible();
  await page.getByRole('button', { name: /כבר יודעים קצת/ }).click();
  await expect(page.locator('.practice-badge')).toHaveText('🎯 מבחן מיקום');
});

test('the shop opens from the gems, not from its own tab', async ({ page }) => {
  await openFresh(page);
  await expect(page.locator('.bottom-nav').getByRole('button', { name: 'חנות' })).toHaveCount(0);
  await page.locator('.gem-stat').click();
  await expect(page.locator('.shop')).toBeVisible();
});

test('a guest sees their own XP in the league invitation', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { xp: 40, completed: { u1l1: 1 } });
  await page.goto('/');
  await page.locator('.bottom-nav').getByRole('button', { name: 'ליגה' }).click();
  await expect(page.locator('.guest-xp')).toContainText('40 XP');
  await expect(page.getByRole('button', { name: 'יצירת פרופיל' })).toBeVisible();
});

test('out of hearts, a review starts right from the screen', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { hearts: 1, heartsUpdatedAt: Date.now(), completed: { u1l1: 1 }, xp: 10 });
  await page.goto('/');
  await openLesson(page, 'u1l2');
  await answer(page, lesson('u1l2'), false);
  await next(page);
  await expect(page.getByRole('heading', { name: 'נגמרו הלבבות' })).toBeVisible();
  await page.getByRole('button', { name: '🧠 לחזרה בלי לבבות' }).click();
  await expect(page.locator('.practice-badge')).toHaveText('🧠 חזרה');
  await expect(page.locator('.exercise-title')).toBeVisible();
});
