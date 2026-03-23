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

test('issue 41: selected queue item is large, others are small, with carousel animation', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into children to get multiple nodes
  await page.keyboard.press('ArrowRight');
  await pause(800);

  // Add first child to queue
  await page.keyboard.press('q');
  await pause(300);

  // Add second child to queue
  await page.keyboard.press('ArrowDown');
  await pause(200);
  await page.keyboard.press('q');
  await pause(300);

  // Add third child to queue
  await page.keyboard.press('ArrowDown');
  await pause(200);
  await page.keyboard.press('q');
  await pause(300);

  // Verify queue bar appears with 3 items
  const queueBar = page.locator('.queue-bar');
  await expect(queueBar).toBeVisible();
  const queueItems = page.locator('.queue-item');
  await expect(queueItems).toHaveCount(3);

  // Navigate back to first child (selectedIndex=0) so ArrowUp enters queue
  await page.keyboard.press('ArrowUp');
  await pause(200);
  await page.keyboard.press('ArrowUp');
  await pause(200);

  // Now ArrowUp from selectedIndex=0 enters queue
  await page.keyboard.press('ArrowUp');
  await pause(500);

  // The queue should now be focused
  await expect(queueBar).toHaveClass(/queue-focused/);

  // First item should be selected and large
  const firstItem = queueItems.nth(0);
  await expect(firstItem).toHaveClass(/queue-large/);
  await expect(firstItem).toHaveClass(/queue-selected/);

  // Other items should be small
  const secondItem = queueItems.nth(1);
  const thirdItem = queueItems.nth(2);
  await expect(secondItem).toHaveClass(/queue-small/);
  await expect(thirdItem).toHaveClass(/queue-small/);

  // Get dimensions — large item should be significantly wider than small items
  const firstBox = await firstItem.boundingBox();
  const secondBox = await secondItem.boundingBox();
  expect(firstBox.width).toBeGreaterThan(secondBox.width * 2);

  // Navigate right — second item should become large, first should become small
  await page.keyboard.press('ArrowRight');
  await pause(600);

  await expect(secondItem).toHaveClass(/queue-large/);
  await expect(secondItem).toHaveClass(/queue-selected/);
  await expect(firstItem).toHaveClass(/queue-small/);
  await expect(thirdItem).toHaveClass(/queue-small/);

  // The container should have shifted (translateX) so selected is left-aligned
  // and we can still see a peek of the first item
  const containerStyle = await page.locator('.queue-items').getAttribute('style');
  expect(containerStyle).toContain('translateX');

  // First item should still be partially visible (peek from the left)
  const firstBoxAfter = await firstItem.boundingBox();
  expect(firstBoxAfter).not.toBeNull();

  // Navigate right again to third item
  await page.keyboard.press('ArrowRight');
  await pause(600);

  await expect(thirdItem).toHaveClass(/queue-large/);
  await expect(thirdItem).toHaveClass(/queue-selected/);
  await expect(firstItem).toHaveClass(/queue-small/);
  await expect(secondItem).toHaveClass(/queue-small/);

  // Navigate back left
  await page.keyboard.press('ArrowLeft');
  await pause(600);

  await expect(secondItem).toHaveClass(/queue-large/);
  await expect(secondItem).toHaveClass(/queue-selected/);
});
