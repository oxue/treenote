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

test('issue 37: queue item renders markdown', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Select the first node and enter edit mode to set markdown text
  await page.keyboard.press('Enter');
  await pause(300);
  const textarea = page.locator('.node-text-input');
  await expect(textarea).toBeVisible();
  await textarea.fill('**bold text** and *italic*');
  await page.keyboard.press('Shift+Enter');
  await pause(300);

  // Toggle markdown on this node with 'm'
  await page.keyboard.press('m');
  await pause(200);

  // Verify the node shows rendered markdown
  const nodeMarkdown = page.locator('.node-box .node-markdown');
  await expect(nodeMarkdown).toBeVisible();

  // Add this node to the queue with 'q'
  await page.keyboard.press('q');
  await pause(300);

  // Queue bar should appear
  const queueBar = page.locator('.queue-bar');
  await expect(queueBar).toBeVisible();

  // The queue item should contain rendered markdown (bold/italic HTML)
  const queueItem = page.locator('.queue-item');
  const queueMarkdown = queueItem.locator('.node-markdown');
  await expect(queueMarkdown).toBeVisible();

  // Verify it contains actual HTML elements (strong/em) from markdown rendering
  const boldEl = queueItem.locator('strong');
  await expect(boldEl).toBeVisible();
  await expect(boldEl).toHaveText('bold text');
});

test('issue 37: clicking already-selected queue item enters edit mode', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Add first node to queue
  await page.keyboard.press('q');
  await pause(300);

  const queueBar = page.locator('.queue-bar');
  await expect(queueBar).toBeVisible();

  // Navigate focus to queue (press Up)
  await page.keyboard.press('ArrowUp');
  await pause(200);

  // The queue should now be focused and item selected
  const queueItem = page.locator('.queue-item.queue-selected');
  await expect(queueItem).toBeVisible();

  // Click the already-selected queue item — should enter edit mode
  await queueItem.click();
  await pause(300);

  // Should now show the edit textarea
  const queueInput = page.locator('.queue-item-input');
  await expect(queueInput).toBeVisible();
});

test('issue 37: Shift+Enter exits queue item edit mode (enterNewline=true)', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Add first node to queue
  await page.keyboard.press('q');
  await pause(300);

  // Navigate focus to queue
  await page.keyboard.press('ArrowUp');
  await pause(200);

  // Enter edit mode on the queue item via Enter key
  await page.keyboard.press('Enter');
  await pause(300);

  const queueInput = page.locator('.queue-item-input');
  await expect(queueInput).toBeVisible();

  // Type some text
  await queueInput.fill('test queue text');
  await pause(100);

  // Shift+Enter should exit edit mode (default enterNewline=true)
  await page.keyboard.press('Shift+Enter');
  await pause(300);

  // Edit textarea should be gone
  await expect(page.locator('.queue-item-input')).not.toBeVisible();

  // Queue item should show the text we typed
  const queueTitle = page.locator('.queue-item-title');
  await expect(queueTitle).toContainText('test queue text');
});
