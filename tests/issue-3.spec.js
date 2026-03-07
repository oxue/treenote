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

test('issue 3: Shift+Z implements redo — delete node, undo, redo', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // The default tree has 3 child nodes. Navigate into them.
  // First, go right into the "Welcome to Treenote" node's children
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Count the nodes and remember the selected node's text
  const initialCount = await page.locator('.node-box').count();
  const selectedText = await page.locator('.node-box.selected .node-text').textContent();

  // DELETE the selected node with 'x'
  await page.keyboard.press('x');
  await pause(800);

  // Verify a node was removed
  const afterDeleteCount = await page.locator('.node-box').count();
  expect(afterDeleteCount).toBe(initialCount - 1);

  // The deleted node's text should no longer appear
  const allTextsAfterDelete = await page.locator('.node-box .node-text').allTextContents();
  expect(allTextsAfterDelete).not.toContain(selectedText);

  // UNDO with 'z' — node should reappear
  await page.keyboard.press('z');
  await pause(800);

  const afterUndoCount = await page.locator('.node-box').count();
  expect(afterUndoCount).toBe(initialCount);

  const allTextsAfterUndo = await page.locator('.node-box .node-text').allTextContents();
  expect(allTextsAfterUndo).toContain(selectedText);

  // REDO with Shift+Z — node should disappear again
  await page.keyboard.press('Shift+Z');
  await pause(800);

  const afterRedoCount = await page.locator('.node-box').count();
  expect(afterRedoCount).toBe(initialCount - 1);

  const allTextsAfterRedo = await page.locator('.node-box .node-text').allTextContents();
  expect(allTextsAfterRedo).not.toContain(selectedText);

  // UNDO again to bring it back — proves multiple cycles work
  await page.keyboard.press('z');
  await pause(800);

  expect(await page.locator('.node-box').count()).toBe(initialCount);
  const allTextsFinal = await page.locator('.node-box .node-text').allTextContents();
  expect(allTextsFinal).toContain(selectedText);
});

test('issue 3: redo hotkey is shown in legend', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });

  const legendText = await page.locator('.hotkey-legend').textContent();
  expect(legendText).toContain('Redo');
  expect(legendText).toContain('Undo');
});
