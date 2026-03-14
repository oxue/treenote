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

test('issue 31: Enter creates newline by default, Shift+Enter exits edit mode', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Verify the legend is visible with categories
  await expect(page.locator('.hotkey-legend')).toBeVisible();
  await expect(page.locator('.legend-category').first()).toBeVisible();
  await expect(page.locator('.legend-divider').first()).toBeVisible();

  // Enter edit mode on the first node
  await page.keyboard.press('Enter');
  await pause(300);

  // Should now be in edit mode with a textarea visible
  const textarea = page.locator('.node-text-input');
  await expect(textarea).toBeVisible();

  // Verify the edit mode legend shows the correct keys
  const legendText = await page.locator('.hotkey-legend').innerText();
  expect(legendText.toLowerCase()).toContain('edit mode');
  // Default enterNewline=true: Enter = new line, Shift+Enter = exit
  expect(legendText).toContain('Shift+Enter');

  // Get the current text value
  const originalText = await textarea.inputValue();

  // Press Enter — should insert a newline (NOT exit edit mode)
  await textarea.press('Enter');
  await pause(200);

  // Textarea should still be visible (still in edit mode)
  await expect(textarea).toBeVisible();

  // The text should now contain a newline
  const textAfterEnter = await textarea.inputValue();
  expect(textAfterEnter).toContain('\n');

  // Now press Shift+Enter — should exit edit mode
  await page.keyboard.press('Shift+Enter');
  await pause(300);

  // Textarea should no longer be visible (exited edit mode)
  await expect(page.locator('.node-text-input')).not.toBeVisible();

  // Should be back in visual mode
  const modeIndicator = page.locator('.mode-indicator');
  await expect(modeIndicator).toHaveText('visual');
});

test('issue 31: legend shows categories with dividers in visual mode', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Check that categories exist
  const categories = page.locator('.legend-category');
  const count = await categories.count();
  expect(count).toBeGreaterThanOrEqual(3);

  // Check that dividers exist
  const dividers = page.locator('.legend-divider');
  const dividerCount = await dividers.count();
  expect(dividerCount).toBeGreaterThanOrEqual(3);

  // Verify specific category names
  const legendText = await page.locator('.hotkey-legend').innerText();
  expect(legendText.toLowerCase()).toContain('navigation');
  expect(legendText.toLowerCase()).toContain('editing');
  expect(legendText.toLowerCase()).toContain('other');
});

test('issue 31: toggle enter behavior via settings', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Open settings
  await page.keyboard.press('s');
  await pause(300);

  // Settings panel should be open
  await expect(page.locator('.web-settings-panel')).toBeVisible();

  // Find and verify the enter behavior section
  const enterSection = page.locator('.enter-behavior-section');
  await expect(enterSection).toBeVisible();

  // The first option (Enter = new line) should be active by default
  const firstOption = page.locator('.enter-option').first();
  await expect(firstOption).toHaveClass(/active/);

  // Click the second option (Enter = exit)
  const secondOption = page.locator('.enter-option').nth(1);
  await secondOption.click();
  await pause(200);

  // Second option should now be active
  await expect(secondOption).toHaveClass(/active/);

  // Close settings
  await page.keyboard.press('Escape');
  await pause(300);

  // Enter edit mode
  await page.keyboard.press('Enter');
  await pause(300);

  const textarea = page.locator('.node-text-input');
  await expect(textarea).toBeVisible();

  // With enterNewline=false, Enter should exit edit mode
  await page.keyboard.press('Enter');
  await pause(300);

  // Should have exited edit mode
  await expect(page.locator('.node-text-input')).not.toBeVisible();
});
