/**
 * Typing exercises ("כתבו באנגלית" / "הקלידו את מה ששמעתם"), from unit 2 on (US-K1):
 * a spelling slip still counts, a grammar slip doesn't, and a Hebrew keyboard costs nothing.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Lesson } from '../src/types';
import { allLessons } from '../src/data/course';
import { answer, finishLesson, lesson, next, openLesson, recordSpeech, seedProgress } from './helpers';

const L = lesson('u2l1');
const shortestEn = (l: Lesson) => l.sentences.reduce((a, b) => (b.en.length < a.en.length ? b : a)).en;
/** A unit-2 lesson whose typed (shortest) sentence has a word long enough for a forgiven slip. */
const SLIP = allLessons.slice(allLessons.indexOf(L)).find((l) =>
  shortestEn(l)
    .split(' ')
    .some((w) => w.replace(/[^a-z]/gi, '').length >= 5),
)!;

async function openTypingLesson(page: Page, l: Lesson = L) {
  const before = Object.fromEntries(allLessons.slice(0, allLessons.indexOf(l)).map((x) => [x.id, 1]));
  await recordSpeech(page);
  await seedProgress(page, { completed: before, xp: 50 });
  await page.goto('/');
  await expect(page.locator('.path')).toBeVisible();
  await openLesson(page, l.id);
}

/** Answers exercises until the typing one is on screen; returns its Hebrew prompt. */
async function untilTyping(page: Page, l: Lesson = L): Promise<string> {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.type-input').isVisible())
      return (await page.locator('.prompt-bubble').textContent())!.trim();
    await answer(page, l);
    await next(page);
  }
  throw new Error('no typing exercise');
}

test('a unit-2 lesson has a typing exercise and can be finished by typing', async ({ page }) => {
  await openTypingLesson(page);
  await untilTyping(page);
  await expect(page.locator('.exercise-title')).toHaveText('כתבו באנגלית');
  await finishLesson(page, L);
  await expect(page.locator('.lesson-complete')).toBeVisible();
});

test('a Hebrew keyboard is caught without losing a heart, and a spelling slip still counts', async ({ page }) => {
  await openTypingLesson(page, SLIP);
  const he = await untilTyping(page, SLIP);
  const sentence = SLIP.sentences.find((s) => s.he === he)!;
  const hearts = await page.locator('.hearts').textContent();

  await page.locator('.type-input').fill('שלום');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.getByRole('alert')).toContainText('המקלדת בעברית');
  await expect(page.locator('.lesson-footer.feedback')).toHaveCount(0);
  await expect(page.locator('.hearts')).toHaveText(hearts!);

  // Swap two letters of the longest word (at least 4 letters, so it counts as a slip).
  const words = sentence.en.replace(/[.,!?]/g, '').split(' ');
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  const slipped = longest.slice(0, 1) + longest[2] + longest[1] + longest.slice(3);
  await page.locator('.type-input').fill(words.map((w) => (w === longest ? slipped : w)).join(' '));
  await page.locator('.type-input').press('Enter');
  const bar = page.locator('.lesson-footer.feedback.good');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('שימו לב לאיות');
  await expect(page.locator('.hearts')).toHaveText(hearts!);
});

test('a wrong typed answer shows the right sentence and costs a heart', async ({ page }) => {
  await openTypingLesson(page);
  const he = await untilTyping(page);
  const sentence = L.sentences.find((s) => s.he === he)!;
  await page.locator('.type-input').fill('banana');
  await page.locator('.type-input').press('Enter');
  const bar = page.locator('.lesson-footer.feedback.bad');
  await expect(bar).toContainText(sentence.en);
  await expect(page.locator('.hearts')).toContainText('4');
});
