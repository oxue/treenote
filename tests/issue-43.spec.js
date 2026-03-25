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

test('issue 43: tree does not jiggle when navigating queue — queue container has fixed height', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into children to get multiple nodes
  await page.keyboard.press('ArrowRight');
  await pause(800);

  // Add three children to the queue
  await page.keyboard.press('q');
  await pause(300);
  await page.keyboard.press('ArrowDown');
  await pause(200);
  await page.keyboard.press('q');
  await pause(300);
  await page.keyboard.press('ArrowDown');
  await pause(200);
  await page.keyboard.press('q');
  await pause(300);

  // Verify queue bar appears with 3 items
  const queueBar = page.locator('.queue-bar');
  await expect(queueBar).toBeVisible();
  await expect(page.locator('.queue-item')).toHaveCount(3);

  // Navigate back to first child so ArrowUp enters queue
  await page.keyboard.press('ArrowUp');
  await pause(200);
  await page.keyboard.press('ArrowUp');
  await pause(200);
  await page.keyboard.press('ArrowUp');
  await pause(500);

  // Queue should be focused
  await expect(queueBar).toHaveClass(/queue-focused/);

  // Wait for animations to settle
  await pause(500);

  // Record the tree section position
  const columnsViewport = page.locator('.columns-viewport');
  const treeBefore = await columnsViewport.boundingBox();

  // Navigate right in the queue — this changes which item is large vs small
  await page.keyboard.press('ArrowRight');
  await pause(600);

  // Record tree position after navigation
  const treeAfter = await columnsViewport.boundingBox();

  // The tree's top position should not have changed (no jiggle)
  expect(treeAfter.y).toBe(treeBefore.y);
  expect(treeAfter.height).toBe(treeBefore.height);

  // Navigate right again and verify stability
  await page.keyboard.press('ArrowRight');
  await pause(600);

  const treeAfter2 = await columnsViewport.boundingBox();
  expect(treeAfter2.y).toBe(treeBefore.y);
  expect(treeAfter2.height).toBe(treeBefore.height);

  // Navigate back left and verify stability
  await page.keyboard.press('ArrowLeft');
  await pause(600);

  const treeAfter3 = await columnsViewport.boundingBox();
  expect(treeAfter3.y).toBe(treeBefore.y);
  expect(treeAfter3.height).toBe(treeBefore.height);
});
