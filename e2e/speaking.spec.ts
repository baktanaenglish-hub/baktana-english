/**
 * Speaking exercises ("אמרו בקול"): the learner reads a sentence out loud and speech
 * recognition checks it. The microphone is faked (fakeRecognition in helpers.ts).
 */
import { expect, test, type Page } from '@playwright/test';
import { answer, fakeRecognition, finishLesson, lesson, next, openLesson, recordSpeech } from './helpers';

const L1 = lesson('u1l1');

async function openWithMicrophone(page: Page) {
  await recordSpeech(page);
  await fakeRecognition(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'בואו נתחיל' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: /מתחילים מאפס/ }).click();
  await expect(page.locator('.path')).toBeVisible();
  await openLesson(page, 'u1l1');
}

/** Answers exercises until a speaking one is on screen. */
async function untilSpeaking(page: Page) {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.mic-btn').count()) return;
    await answer(page, L1);
    await next(page);
    await expect(page.locator('.exercise-title')).toBeVisible();
  }
  throw new Error('no speaking exercise');
}

test('a lesson has two speaking exercises; a misheard sentence asks to try again, without losing a heart', async ({
  page,
}) => {
  await openWithMicrophone(page);
  await untilSpeaking(page);
  await expect(page.locator('.exercise-title')).toHaveText('אמרו בקול');
  const sentence = (await page.locator('.speak-prompt').textContent())!.trim();
  expect(L1.sentences.map((s) => s.en)).toContain(sentence);

  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = 'banana'));
  await page.getByRole('button', { name: 'לחצו ודברו' }).click();
  await expect(page.locator('.mic-status')).toContainText('כמעט! נסו שוב.');
  await expect(page.locator('.mic-heard')).toContainText('banana');
  await expect(page.locator('.lesson-footer.feedback')).toHaveCount(0);
  await expect(page.locator('.hearts')).toContainText('5');

  await page.evaluate(() => ((window as unknown as { __heard: string | null }).__heard = null));
  await page.getByRole('button', { name: 'לחצו ודברו' }).click();
  await expect(page.locator('.lesson-footer.feedback.good')).toBeVisible();
  await next(page);

  const seen = await finishLesson(page, L1);
  expect(seen.filter((p) => p.startsWith('speak:'))).toHaveLength(1);
  await expect(page.locator('.lesson-complete h2')).toHaveText('השיעור הושלם!');
});

test('"can\'t speak now" skips the speaking exercises left in the lesson', async ({ page }) => {
  await openWithMicrophone(page);
  await untilSpeaking(page);
  await page.getByRole('button', { name: 'לא יכול/ה לדבר עכשיו' }).click();
  const seen = await finishLesson(page, L1);
  expect(seen.some((p) => p.startsWith('speak:'))).toBe(false);
  await expect(page.locator('.lesson-complete h2')).toHaveText('השיעור הושלם!');
});

test('speaking exercises can be turned off in the profile', async ({ page }) => {
  await recordSpeech(page);
  await fakeRecognition(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'בואו נתחיל' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: /מתחילים מאפס/ }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: 'פרופיל' }).click();
  const toggle = page.getByRole('switch', { name: 'תרגילי דיבור (מיקרופון)' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.locator('.bottom-nav').getByRole('button', { name: 'לימוד' }).click();
  await openLesson(page, 'u1l1');
  const seen = await finishLesson(page, L1);
  expect(seen).toHaveLength(12);
});
