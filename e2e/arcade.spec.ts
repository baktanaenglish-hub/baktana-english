/**
 * The arcade 🎮: the word rush opens after unit 1, the memory game is bought with gems.
 */
import { expect, test, type Page } from '@playwright/test';
import { course } from '../src/data/course';
import { recordSpeech, seedProgress } from './helpers';

const SHOTS = process.env.GEM_SHOTS;
const GEMS_KEY = 'baktana-english:gems:v1';
const words = course.flatMap((u) => u.lessons.flatMap((l) => l.words));

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function openArcade(page: Page, completed: Record<string, number>, gems: number) {
  await page.setViewportSize({ width: 390, height: 844 });
  await recordSpeech(page);
  await seedProgress(page, { completed });
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-gems')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-gems', '1');
      }
    },
    [GEMS_KEY, JSON.stringify({ gems })] as const,
  );
  await page.goto('/');
  await page.locator('.arcade-card', { hasText: 'משחקי מילים' }).click();
  await expect(page.locator('.arcade')).toBeVisible();
}

test('the arcade has its own tab, also on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await recordSpeech(page);
  await seedProgress(page, { completed: { [course[0].lessons[0].id]: 1 } });
  await page.goto('/');
  await page.locator('.bottom-nav').getByRole('button', { name: 'משחקים' }).click();
  await expect(page.locator('.arcade')).toBeVisible();
  await shot(page, '9-nav');
});

test('the word rush is locked until unit 1 is done', async ({ page }) => {
  await openArcade(page, { [course[0].lessons[0].id]: 1 }, 20);
  const rush = page.locator('.game-card[data-game="rush"]');
  await expect(rush).toContainText(`(1/${course[0].lessons.length})`);
  await expect(rush.getByRole('button', { name: 'שחקו!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /פתיחת זיכרון/ })).toBeDisabled();
  await shot(page, '5-arcade-locked');
});

test('the word rush counts right answers and a combo', async ({ page }) => {
  await openArcade(page, Object.fromEntries(course[0].lessons.map((l) => [l.id, 1])), 0);
  await page.locator('.game-card[data-game="rush"]').getByRole('button', { name: 'שחקו!' }).click();
  for (let i = 0; i < 3; i++) {
    const en = (await page.locator('.rush-word').textContent())!.trim();
    const he = words.find((w) => w.en === en)!.he;
    await page.locator('.rush-option', { hasText: he }).first().click();
    await expect(page.locator('.rush-word')).not.toHaveClass(/good/);
  }
  // 10 + 20 + 30 with the combo.
  await expect(page.locator('.rush-score')).toHaveText('⭐ 60');
  await expect(page.locator('.rush-combo')).toContainText('x3');
  await shot(page, '6-rush');
  await page.getByRole('button', { name: 'יציאה מהמשחק' }).click();
  await expect(page.locator('.arcade')).toBeVisible();
});

test('the memory game is bought with gems and pays when finished', async ({ page }) => {
  await openArcade(page, {}, 150);
  await page.getByRole('button', { name: /פתיחת זיכרון/ }).click();
  await expect(page.locator('.gem-stat')).toContainText('50');
  await page.locator('.game-card[data-game="memory"]').getByRole('button', { name: 'שחקו!' }).click();
  await page.locator('.memory-card').nth(0).click();
  await page.locator('.memory-card').nth(1).click();
  await shot(page, '7-memory');
  await page.waitForTimeout(1000);
  // Solve the board pair by pair.
  for (let pair = 0; pair < 6; pair++) {
    const cards = page.locator(`.memory-card[data-pair="${pair}"]:not(.matched)`);
    if ((await cards.count()) === 0) continue;
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.locator(`.memory-card.matched[data-pair="${pair}"]`)).toHaveCount(2);
  }
  await expect(page.locator('.game-result')).toBeVisible();
  await expect(page.locator('.reward-list')).toContainText('נקודות');
  await shot(page, '8-result');
});
