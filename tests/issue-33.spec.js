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

test('issue 33: legend arrow symbols are consistent triangles', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Legend should be visible in visual mode
  await expect(page.locator('.hotkey-legend')).toBeVisible();

  // Get all kbd elements inside arrow-keys spans (the navigation symbols)
  const arrowKbds = page.locator('.arrow-keys kbd');
  const count = await arrowKbds.count();
  expect(count).toBeGreaterThan(0);

  // Collect all arrow symbol texts
  const symbols = new Set();
  for (let i = 0; i < count; i++) {
    const text = await arrowKbds.nth(i).innerText();
    // Only check single-char arrow/triangle symbols, skip modifier keys and letters
    if (text.length === 1 && !text.match(/[a-zA-Z0-9⇧⌘+]/)) {
      symbols.add(text);
    }
  }

  // The four triangle symbols should be from the consistent BLACK POINTING TRIANGLE family
  const expectedTriangles = new Set(['▲', '▼', '◀', '▶']);
  // The old broken symbols used POINTER characters (◄ ►) which render differently
  const brokenPointers = ['◄', '►'];

  for (const sym of symbols) {
    expect(expectedTriangles.has(sym)).toBe(true);
  }

  // Verify none of the old inconsistent pointer characters appear
  for (const broken of brokenPointers) {
    expect(symbols.has(broken)).toBe(false);
  }
});
