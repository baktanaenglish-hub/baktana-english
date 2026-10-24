/**
 * Groups, group challenges and the period leaderboards (shared/groups.ts) against the Express API.
 */
import { expect, test, type Page } from '@playwright/test';
import { finishLesson, lesson, openFresh, openLesson, recordSpeech } from './helpers';

const L1 = lesson('u1l1');
let counter = 0;
const uniqueEmail = () => `groups-${Date.now()}-${counter++}@example.com`;

async function fillRegister(page: Page, name: string) {
  await page.getByLabel('שם תצוגה').fill(name);
  await page.getByLabel('אימייל').fill(uniqueEmail());
  await page.getByLabel('סיסמה').fill('password123');
  await page.getByRole('button', { name: 'יצירת חשבון' }).click();
}

const nav = (page: Page, name: string) => page.locator('.bottom-nav').getByRole('button', { name }).click();
const leagueView = (page: Page, name: RegExp) => page.locator('.league-tabs').getByRole('tab', { name }).click();

test('a learner creates a group, a friend joins with the invite link, and their XP counts for it', async ({
  page,
  browser,
}) => {
  // The owner signs up, finishes a lesson and creates a group.
  await openFresh(page);
  await nav(page, 'פרופיל');
  await page.getByRole('button', { name: 'יצירת פרופיל / התחברות' }).click();
  await fillRegister(page, 'מייסדת');
  await expect(page.locator('.account-info h2')).toHaveText('מייסדת');

  await nav(page, 'ליגה');
  await leagueView(page, /הקבוצות שלי/);
  await expect(page.locator('.my-groups')).toContainText('עוד אין לכם קבוצה');
  await page.getByLabel('שם הקבוצה').fill('  המשפחה  ');
  await page.getByRole('button', { name: 'יצירה' }).click();
  await expect(page.getByRole('heading', { name: /המשפחה/ })).toBeVisible();
  const code = (await page.locator('.invite-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(page.locator('.challenge')).toHaveCount(3);

  // The friend opens the invite link as a guest, signs up and joins.
  const friendContext = await browser.newContext({ locale: 'he-IL', viewport: { width: 420, height: 860 } });
  const friend = await friendContext.newPage();
  await recordSpeech(friend);
  await friend.goto(`/?join=${code}`);
  // A first visit starts with onboarding, then lands on "my groups" with the invite.
  await friend.getByRole('button', { name: 'בואו נתחיל' }).click();
  await friend.getByRole('button', { name: 'המשך' }).click();
  await friend.getByRole('button', { name: /מתחילים מאפס/ }).click();
  await expect(friend.locator('.my-groups')).toContainText(`קוד ${code}`);
  expect(friend.url()).not.toContain('join=');
  await friend.locator('.my-groups').getByRole('button', { name: 'יצירת פרופיל' }).click();
  await fillRegister(friend, 'חבר טוב');
  await expect(friend.getByLabel('קוד הצטרפות')).toHaveValue(code);
  await friend.getByRole('button', { name: 'הצטרפות' }).click();
  await expect(friend.getByRole('heading', { name: /המשפחה/ })).toBeVisible();
  await expect(friend.locator('.group-page')).toContainText('2 / 30 חברים');

  // The friend learns: the XP shows on the group's board and on the group league.
  await nav(friend, 'לימוד');
  await openLesson(friend, 'u1l1');
  await finishLesson(friend, L1);
  await friend.getByRole('button', { name: 'המשך' }).click();
  await nav(friend, 'ליגה');
  await leagueView(friend, /הקבוצות שלי/);
  await friend.locator('.group-card').click();
  await expect(friend.locator('.group-members .board-row.me')).toContainText('15 XP');
  await expect(friend.locator('.challenge').nth(1)).toContainText('1 /');

  await leagueView(friend, /^🏟️ קבוצות/);
  const mine = friend.locator('.group-board .board-row.me');
  await expect(mine).toContainText('המשפחה');
  await expect(mine).toContainText('2 חברים · 15 XP');
  // 15 XP over two members, counted as three for fairness.
  await expect(mine.locator('.board-xp')).toHaveText('5 XP');

  // The personal league by period.
  await leagueView(friend, /אישי/);
  await friend.getByRole('radio', { name: 'החודש' }).click();
  await expect(friend.getByRole('heading', { name: /הליגה החודשית/ })).toBeVisible();
  await expect(friend.locator('.leaderboard .board-row.me')).toContainText('15 XP');
  await friend.getByRole('radio', { name: 'מצטבר' }).click();
  await expect(friend.getByRole('heading', { name: /הדירוג המצטבר/ })).toBeVisible();

  // The owner leaves; the friend becomes the owner.
  await page.getByRole('button', { name: 'עזיבת הקבוצה' }).click();
  await page.getByRole('button', { name: 'כן, לעזוב' }).click();
  await expect(page.locator('.my-groups')).toContainText('עוד אין לכם קבוצה');
  await friend.reload();
  await nav(friend, 'ליגה');
  await leagueView(friend, /הקבוצות שלי/);
  await friend.locator('.group-card').click();
  await expect(friend.locator('.group-members .board-row.me')).toContainText('מייסד/ת הקבוצה');
  await friendContext.close();
});
