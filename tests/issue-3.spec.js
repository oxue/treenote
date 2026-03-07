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
  // Mock Supabase auth session endpoint
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
    });
  });

  // Mock the user tree storage (return null so default tree loads)
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

  // Inject a fake session into localStorage before page loads
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

test('issue 3: Shift+Z implements redo after undo', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  // Wait for the app to load with tree nodes
  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Press 'c' to toggle check on the selected node (this is an undoable action)
  await page.keyboard.press('c');

  // Verify the node is now checked
  await expect(page.locator('.node-box.selected.checked')).toBeVisible();

  // Undo with 'z'
  await page.keyboard.press('z');

  // Verify the node is no longer checked (undo worked)
  await expect(page.locator('.node-box.selected.checked')).not.toBeVisible();

  // Redo with Shift+Z
  await page.keyboard.press('Shift+Z');

  // Verify the node is checked again (redo worked)
  await expect(page.locator('.node-box.selected.checked')).toBeVisible();

  // Undo again to verify multiple undo/redo cycles work
  await page.keyboard.press('z');
  await expect(page.locator('.node-box.selected.checked')).not.toBeVisible();

  // Redo again
  await page.keyboard.press('Shift+Z');
  await expect(page.locator('.node-box.selected.checked')).toBeVisible();

  // Undo, then perform a new action — redo stack should be cleared
  await page.keyboard.press('z');
  await expect(page.locator('.node-box.selected.checked')).not.toBeVisible();

  // Move down (new action after undo clears redo stack via navigation, but navigation
  // doesn't go through applyAction). Let's use 'c' as the new action instead.
  await page.keyboard.press('c');
  await expect(page.locator('.node-box.selected.checked')).toBeVisible();

  // Undo the new check
  await page.keyboard.press('z');

  // Redo should redo that last check (not the original one)
  await page.keyboard.press('Shift+Z');
  await expect(page.locator('.node-box.selected.checked')).toBeVisible();
});

test('issue 3: redo hotkey is shown in legend', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });

  // Verify the hotkey legend shows the redo shortcut
  const legendText = await page.locator('.hotkey-legend').textContent();
  expect(legendText).toContain('Redo');
  expect(legendText).toContain('Undo');
});
