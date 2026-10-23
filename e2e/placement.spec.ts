/**
 * Placement test (US-P3): three questions per unit, two right to pass it; the first unit
 * below that ends the test and the passed units' lessons are marked completed.
 */
import { expect, test, type Page } from '@playwright/test';
import { allLessons, course } from '../src/data/course';
import { answer, localProgress, next, openFresh } from './helpers';

/** Answers the question on screen, finding its lesson from the prompt. */
async function answerAny(page: Page, correct: boolean) {
  const word = page.locator('.prompt-word');
  const prompt = (await word.count())
    ? (await word.textContent())!.trim()
    : (await page.locator('.prompt-bubble').textContent())!.trim();
  const lesson = allLessons.find(
    (l) => l.words.some((w) => w.en === prompt || w.he === prompt) || l.sentences.some((s) => s.he === prompt),
  )!;
  await answer(page, lesson, correct);
}

async function startPlacement(page: Page) {
  await openFresh(page);
  await page.getByRole('button', { name: '🎯 מבחן מיקום' }).click();
  await expect(page.locator('.practice-badge')).toHaveText('🎯 מבחן מיקום');
}

test('two known units skip ahead to unit 3', async ({ page }) => {
  await startPlacement(page);
  // Units 1 and 2 right, then unit 3 wrong.
  for (const correct of [true, true, true, true, true, true, false, false, false]) {
    await answerAny(page, correct);
    await next(page);
  }
  await expect(page.locator('.lesson-complete')).toContainText('דילגת על 2 יחידות');
  await page.getByRole('button', { name: 'למסלול' }).click();
  const progress = await localProgress(page);
  for (const l of [...course[0].lessons, ...course[1].lessons]) expect(progress.completed[l.id]).toBe(1);
  expect(progress.completed[course[2].lessons[0].id]).toBeUndefined();
  expect(progress.xp).toBe(0);
  // Past unit 1 now, so the offer is gone.
  await expect(page.getByRole('button', { name: '🎯 מבחן מיקום' })).toHaveCount(0);
});

test('failing unit 1 starts from the beginning, without losing hearts', async ({ page }) => {
  await startPlacement(page);
  for (const correct of [false, true, false]) {
    await answerAny(page, correct);
    await next(page);
  }
  await expect(page.locator('.lesson-complete')).toContainText('מתחילים מההתחלה');
  await page.getByRole('button', { name: 'למסלול' }).click();
  const progress = await localProgress(page);
  expect(Object.keys(progress.completed)).toHaveLength(0);
  expect(progress.hearts).toBe(5);
});
