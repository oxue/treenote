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

test('issue 12: checking queue ref item also checks the tree node', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Select the first node ("Welcome to Treenote")
  await pause(500);

  // Verify node is not checked initially
  const firstNode = page.locator('.node-box').first();
  await expect(firstNode).not.toHaveClass(/checked/);

  // Press 'q' to add the selected node to the queue
  await page.keyboard.press('q');
  await pause(300);

  // Verify queue bar appears with the item
  const queueBar = page.locator('.queue-bar');
  await expect(queueBar).toBeVisible();
  const queueItem = page.locator('.queue-box').first();
  await expect(queueItem).toContainText('Welcome to Treenote');

  // Navigate up to the queue
  await page.keyboard.press('ArrowUp');
  await pause(300);

  // Press 'c' to check off the queue item — should also check the tree node
  await page.keyboard.press('c');
  await pause(500);

  // The tree node should now be checked (has .checked class with strikethrough)
  const checkedNode = page.locator('.node-box.checked');
  await expect(checkedNode).toBeVisible();
});

test('issue 12: queue ref items show live text from tree', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Add the first node to queue
  await page.keyboard.press('q');
  await pause(300);

  // Verify queue shows "Welcome to Treenote"
  const queueItem = page.locator('.queue-box').first();
  await expect(queueItem).toContainText('Welcome to Treenote');

  // Edit the tree node text
  await page.keyboard.press('Enter');
  await pause(300);
  await page.locator('.node-text-input').fill('Updated Title');
  await page.keyboard.press('Escape');
  await pause(500);

  // The queue item should now show the updated text (live reference)
  await expect(queueItem).toContainText('Updated Title');
});

test('issue 12: editing queue ref item updates the tree node', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into children
  await page.keyboard.press('ArrowRight');
  await pause(800);

  // Add first child to queue
  await page.keyboard.press('q');
  await pause(300);

  // Navigate up to queue
  await page.keyboard.press('ArrowUp');
  await pause(300);

  // Press Enter to edit the queue ref item
  await page.keyboard.press('Enter');
  await pause(300);

  // Type new text in the queue edit input
  const queueInput = page.locator('.queue-text-input');
  await expect(queueInput).toBeVisible();
  await queueInput.fill('Edited from queue');
  await page.keyboard.press('Escape');
  await pause(500);

  // The tree node should now reflect the edited text
  const firstNode = page.locator('.node-box').first();
  await expect(firstNode).toContainText('Edited from queue');
});
