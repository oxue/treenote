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

test('issue 35: metadata panel shows only active field expanded, others collapsed', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Open metadata panel with 'd' key
  await page.keyboard.press('d');
  await pause(500);

  // Panel should be visible
  const panel = page.locator('.metadata-panel');
  await expect(panel).toBeVisible();

  // Should be full viewport height (top:0 bottom:0)
  const panelBox = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox.height).toBe(viewport.height);

  // Default active field is 'deadline' — calendar should be visible
  await expect(page.locator('.cal-grid')).toBeVisible();

  // Inactive fields should NOT show their picker content
  // Time picker, duration picker, priority list should be hidden
  await expect(page.locator('.time-picker')).not.toBeVisible();
  await expect(page.locator('.priority-list')).not.toBeVisible();

  // All 4 meta-field labels should still be visible (collapsed fields show labels)
  const fields = page.locator('.meta-field');
  await expect(fields).toHaveCount(4);

  // Only one field should have 'active' class
  const activeFields = page.locator('.meta-field.active');
  await expect(activeFields).toHaveCount(1);

  // Tab to time field
  await page.keyboard.press('Tab');
  await pause(300);

  // Now time picker should be visible, calendar should be hidden
  await expect(page.locator('.time-picker').first()).toBeVisible();
  await expect(page.locator('.cal-grid')).not.toBeVisible();

  // Still only one active field
  await expect(page.locator('.meta-field.active')).toHaveCount(1);

  // Tab to duration
  await page.keyboard.press('Tab');
  await pause(300);

  // Duration picker visible (second .time-picker), time picker hidden
  const timePickers = page.locator('.time-picker');
  await expect(timePickers).toHaveCount(1); // only the active one renders

  // Tab to priority
  await page.keyboard.press('Tab');
  await pause(300);

  // Priority list should be visible
  await expect(page.locator('.priority-list')).toBeVisible();
  await expect(page.locator('.time-picker')).not.toBeVisible();
  await expect(page.locator('.cal-grid')).not.toBeVisible();

  // Close with Escape
  await page.keyboard.press('Escape');
  await pause(300);
  await expect(panel).not.toBeVisible();
});

test('issue 35: clicking inactive field switches to it', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Open metadata panel
  await page.keyboard.press('d');
  await pause(500);

  await expect(page.locator('.metadata-panel')).toBeVisible();

  // Default: deadline is active
  await expect(page.locator('.cal-grid')).toBeVisible();

  // Click on the priority field (4th meta-field)
  const priorityField = page.locator('.meta-field').nth(3);
  await priorityField.click();
  await pause(300);

  // Priority should now be active with its list visible
  await expect(page.locator('.priority-list')).toBeVisible();
  // Calendar should be hidden
  await expect(page.locator('.cal-grid')).not.toBeVisible();

  await page.keyboard.press('Escape');
});
