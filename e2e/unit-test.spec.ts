/**
 * End-of-unit test (US-T2): opens when every lesson of the unit is done; 8 of 10 earns a
 * crown and 20 XP, fewer offers a retry.
 */
import { expect, test, type Page } from '@playwright/test';
import { course } from '../src/data/course';
import { answer, localProgress, next, recordSpeech, seedProgress } from './helpers';

const UNIT = course[0];

/** Answers the question on screen, finding its lesson from the shown or spoken prompt. */
async function answerAny(page: Page, correct: boolean) {
  // The shown prompt, or – for listening, where nothing is shown – the last spoken sentence.
  const shown = (await page.locator('.prompt-word, .prompt-bubble').allTextContents()).map((t) => t.trim());
  const texts = shown.length
    ? shown
    : [await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1) ?? '')];
  const lesson = UNIT.lessons.find((l) =>
    texts.some(
      (t) => l.words.some((w) => w.en === t || w.he === t) || l.sentences.some((s) => s.en === t || s.he === t),
    ),
  )!;
  await answer(page, lesson, correct);
}

async function openUnitTest(page: Page) {
  await recordSpeech(page);
  await seedProgress(page, { completed: Object.fromEntries(UNIT.lessons.map((l) => [l.id, 1])) });
  await page.goto('/');
  await page.getByRole('button', { name: 'מבחן יחידה', exact: true }).first().click();
  await expect(page.locator('.practice-badge')).toHaveText('🏆 מבחן יחידה');
}

test('the unit test is locked until every lesson of the unit is done', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { completed: { [UNIT.lessons[0].id]: 1 } });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /מבחן יחידה \(נעול/ }).first()).toBeDisabled();
});

test('passing earns a crown and 20 XP', async ({ page }) => {
  await openUnitTest(page);
  for (let i = 0; i < 10; i++) {
    await answerAny(page, i !== 0); // one mistake: 9 of 10
    await next(page);
  }
  await expect(page.locator('.lesson-complete')).toContainText('9 מתוך 10');
  await expect(page.locator('.lesson-complete')).toContainText('עברת את מבחן היחידה');
  await page.getByRole('button', { name: 'למסלול' }).click();
  expect((await localProgress(page)).completed.u1cp).toBe(1);
  expect((await localProgress(page)).xp).toBe(20);
  await expect(page.locator('.unit-crown').first()).toBeVisible();
});

test('failing shows the score and offers a retry', async ({ page }) => {
  await openUnitTest(page);
  for (let i = 0; i < 10; i++) {
    await answerAny(page, i >= 3); // 7 of 10
    await next(page);
  }
  await expect(page.locator('.lesson-complete')).toContainText('7 מתוך 10');
  await page.getByRole('button', { name: 'לנסות שוב' }).click();
  await expect(page.locator('.practice-badge')).toHaveText('🏆 מבחן יחידה');
  expect((await localProgress(page)).completed.u1cp).toBeUndefined();
});
