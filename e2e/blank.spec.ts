/** Fill in the blank (US-K3): pick the missing word; the gap fills and the answer is checked. */
import { expect, test } from '@playwright/test';
import { answer, lesson, next, openLesson, recordSpeech, seedProgress } from './helpers';

const L = lesson('u1l2');

test('a lesson has a fill-in-the-blank exercise that fills the gap and is checked', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { completed: { u1l1: 1 } });
  await page.goto('/');
  await openLesson(page, L.id);
  for (let i = 0; i < 20 && !(await page.locator('.blank-sentence').isVisible()); i++) {
    await answer(page, L);
    await next(page);
  }
  await expect(page.locator('.exercise-title')).toHaveText('השלימו את המשפט');
  const tile = page.locator('.bank .tile').first();
  const word = (await tile.textContent())!.trim();
  await tile.click();
  await expect(page.locator('.blank-gap')).toHaveText(word);
  // Changing the choice is allowed until checking.
  await answer(page, L);
  await expect(page.locator('.lesson-footer.feedback.good')).toBeVisible();
});

test('a wrong word shows the whole sentence and costs a heart', async ({ page }) => {
  await recordSpeech(page);
  await seedProgress(page, { completed: { u1l1: 1 } });
  await page.goto('/');
  await openLesson(page, L.id);
  for (let i = 0; i < 20 && !(await page.locator('.blank-sentence').isVisible()); i++) {
    await answer(page, L);
    await next(page);
  }
  const he = (await page.locator('.blank-meaning').textContent())!.trim();
  await answer(page, L, false);
  await expect(page.locator('.lesson-footer.feedback.bad')).toContainText(L.sentences.find((s) => s.he === he)!.en);
  await expect(page.locator('.hearts')).toContainText('4');
});
