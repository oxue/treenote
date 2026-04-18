import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://etfkdcsoazbxiqzsjkrh.supabase.co';

const fakeSession = {
  access_token: 'fake-token',
  refresh_token: 'fake-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'test-user-id',
    email: 'test@test.com',
    aud: 'authenticated',
    role: 'authenticated',
  },
};

async function setupMocks(page) {
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
    });
  });

  await page.route(`${SUPABASE_URL}/auth/v1/user*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession.user),
    });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/user_trees*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  });

  await page.route(`${SUPABASE_URL}/rest/v1/user_queues*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  });

  await page.route(`${SUPABASE_URL}/rest/v1/tree_backups*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.addInitScript((url) => {
    const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    const session = {
      access_token: 'fake-token',
      refresh_token: 'fake-refresh',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: 'test@test.com',
        aud: 'authenticated',
        role: 'authenticated',
      },
    };
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, SUPABASE_URL);
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

test('issue-51: selecting a date in calendar sets the correct deadline without off-by-one', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Press 'd' to open the metadata panel (deadline calendar)
  await page.keyboard.press('d');
  await page.waitForSelector('.metadata-panel');

  // Navigate to a specific day and set it via Enter
  const today = new Date();
  const targetDay = 15;
  const currentDay = today.getDate();
  const diff = targetDay - currentDay;

  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      await page.keyboard.press('ArrowRight');
    }
  } else if (diff < 0) {
    for (let i = 0; i < Math.abs(diff); i++) {
      await page.keyboard.press('ArrowLeft');
    }
  }

  // Verify cursor is on target day
  const cursorCell = page.locator('.cal-cell.cursor');
  await expect(cursorCell).toHaveText(String(targetDay));

  // Press Enter to set the deadline
  await page.keyboard.press('Enter');

  // Verify the deadline value matches what we selected (YYYY-MM-DD format)
  const deadlineValue = page.locator('.meta-field-value').first();
  const deadlineText = await deadlineValue.textContent();
  const parts = deadlineText.split('-');
  const setDay = parseInt(parts[2], 10);

  // Key assertion: the day we selected must be the day that was set
  expect(setDay).toBe(targetDay);

  // Also test click-based selection on day 20
  const day20Cell = page.locator('.cal-cell').filter({ hasText: /^20$/ });
  await day20Cell.click();

  const updatedText = await deadlineValue.textContent();
  const updatedDay = parseInt(updatedText.split('-')[2], 10);
  expect(updatedDay).toBe(20);

  // Wait for video capture
  await pause(500);
});
