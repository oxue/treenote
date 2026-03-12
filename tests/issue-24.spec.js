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
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
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

test('issue 24: emoji picker appears when typing colon and inserts emoji', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Enter edit mode on the first node
  await page.keyboard.press('Enter');
  await pause(300);

  const textarea = page.locator('.node-text-input');
  await expect(textarea).toBeVisible();

  // Select all existing text and type over it
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('hello :smi');
  await pause(500);

  // The emoji picker should appear
  const picker = page.locator('.emoji-picker');
  await expect(picker).toBeVisible();

  // Should show filtered results containing "smi" (smile, smirk, etc.)
  const items = picker.locator('.emoji-picker-item');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);

  // First item should be selected by default
  await expect(items.first()).toHaveClass(/selected/);

  // Verify shortcodes contain our query
  const firstCode = await items.first().locator('.emoji-picker-code').textContent();
  expect(firstCode).toContain('smi');

  // Use arrow down to move selection
  await page.keyboard.press('ArrowDown');
  await pause(100);
  const secondItem = items.nth(1);
  if (await secondItem.count() > 0) {
    await expect(secondItem).toHaveClass(/selected/);
  }

  // Press ArrowUp to go back to first
  await page.keyboard.press('ArrowUp');
  await pause(100);
  await expect(items.first()).toHaveClass(/selected/);

  // Press Enter to select the emoji
  await page.keyboard.press('Enter');
  await pause(300);

  // Emoji picker should disappear
  await expect(picker).not.toBeVisible();

  // The textarea should contain the emoji (colon prefix replaced)
  const value = await textarea.inputValue();
  expect(value).toContain('hello ');
  // Should not contain the colon query anymore
  expect(value).not.toContain(':smi');

  // Escape to commit and exit edit mode
  await page.keyboard.press('Escape');
  await pause(300);
});

test('issue 24: emoji picker closes on Escape without inserting', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Enter edit mode
  await page.keyboard.press('Enter');
  await pause(300);

  const textarea = page.locator('.node-text-input');
  await textarea.fill('');
  await textarea.type('test :fire');
  await pause(300);

  // Picker should be visible
  const picker = page.locator('.emoji-picker');
  await expect(picker).toBeVisible();

  // Press Escape to close picker (not exit edit mode)
  await page.keyboard.press('Escape');
  await pause(200);

  // Picker should be hidden
  await expect(picker).not.toBeVisible();

  // Text should still contain the original colon text
  const value = await textarea.inputValue();
  expect(value).toBe('test :fire');

  // We should still be in edit mode (textarea visible)
  await expect(textarea).toBeVisible();

  // Now Escape again to exit edit mode
  await page.keyboard.press('Escape');
  await pause(300);
});

test('issue 24: emoji picker with mouse click selection', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Enter edit mode
  await page.keyboard.press('Enter');
  await pause(300);

  const textarea = page.locator('.node-text-input');
  await textarea.fill('');
  await textarea.type(':rock');
  await pause(300);

  // Picker should show rocket
  const picker = page.locator('.emoji-picker');
  await expect(picker).toBeVisible();

  // Click on the first emoji item
  const firstItem = picker.locator('.emoji-picker-item').first();
  await firstItem.click();
  await pause(300);

  // Picker should close
  await expect(picker).not.toBeVisible();

  // Textarea should have the emoji
  const value = await textarea.inputValue();
  expect(value).not.toContain(':rock');

  await page.keyboard.press('Escape');
  await pause(300);
});
