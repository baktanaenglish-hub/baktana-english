/**
 * Gems 💎: a daily chest, gems and quest rewards for a lesson, and the shop.
 */
import { expect, test, type Page } from '@playwright/test';
import { finishLesson, lesson, openFresh, openLesson } from './helpers';

const SHOTS = process.env.GEM_SHOTS;

/** Screenshots for reviewing the design, only when GEM_SHOTS names a folder. */
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('the daily chest, a lesson and the shop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFresh(page);

  // The chest opens once a day.
  const chest = page.getByRole('button', { name: 'פתיחת התיבה היומית' });
  await chest.scrollIntoViewIfNeeded();
  await shot(page, '1-path');
  await chest.click();
  await shot(page, '1b-opened');
  await expect(page.locator('.chest-text')).toContainText('קיבלתם');
  await expect(page.getByRole('button', { name: 'התיבה היומית כבר נפתחה היום' })).toBeDisabled();
  const afterChest = Number((await page.locator('.gem-stat').textContent())!.replace(/\D/g, ''));
  expect(afterChest).toBeGreaterThanOrEqual(5);

  // A finished lesson pays gems and lists what they were for.
  await openLesson(page, 'u1l1');
  await finishLesson(page, lesson('u1l1'));
  await expect(page.locator('.stat-card.gems')).toBeVisible();
  await expect(page.locator('.reward-list')).toContainText('שיעור הושלם');
  await shot(page, '2-complete');
  await page.getByRole('button', { name: 'המשך' }).click();
  // The quests fold into one line on the path; it counts the done ones and opens the list.
  const quests = page.getByRole('button', { name: /משימות יומיות/ });
  await expect(quests).toHaveAttribute('aria-expanded', 'false');
  await expect(quests).not.toContainText('0/3');
  await quests.click();
  await expect(page.locator('.quests li.done').first()).toBeVisible();

  // The shop: buying bonus hearts raises the hearts in the top bar.
  await page.locator('.gem-stat').click();
  await expect(page.locator('.shop')).toBeVisible();
  await shot(page, '3-shop');
  const before = Number((await page.locator('.gem-count').textContent())!);
  await page.getByRole('button', { name: /קנייה: 3 לבבות בונוס/ }).click();
  await expect(page.locator('.gem-count')).toHaveText(String(before - 30));
  await expect(page.locator('.top-stats')).toContainText('❤️ 8');
});
