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
  // Intercept ALL Supabase auth requests
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

test('issue 11: legend uses compact three-column grid layout to reduce vertical space', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });

  // Wait for the hotkey legend to appear
  const legend = page.locator('.hotkey-legend');
  await expect(legend).toBeVisible({ timeout: 5000 });

  // Verify the legend uses a grid layout with three columns
  const display = await legend.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('grid');

  const gridTemplateColumns = await legend.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  // Should have three column values (three columns)
  const columnCount = gridTemplateColumns.split(' ').length;
  expect(columnCount).toBe(3);

  // Verify the legend height is reasonable (less than half the viewport height)
  const legendBox = await legend.boundingBox();
  expect(legendBox.height).toBeLessThan(450);

  // Verify all legend rows are still visible
  const legendRows = page.locator('.hotkey-legend .legend-row');
  const rowCount = await legendRows.count();
  expect(rowCount).toBeGreaterThanOrEqual(10);

  // Verify the legend width is wider now (using horizontal space efficiently)
  expect(legendBox.width).toBeGreaterThan(200);
});
