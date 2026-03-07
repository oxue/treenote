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

test('issue 8: markdown renders in child column when navigating away', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into children of "Welcome to Treenote"
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Edit the first child to have markdown content
  await page.keyboard.press('Enter');
  await pause(300);
  await page.locator('.node-text-input').fill('**bold** and *italic*');
  await page.keyboard.press('Escape');
  await pause(500);

  // Toggle markdown on
  await page.keyboard.press('m');
  await pause(500);

  // Verify markdown renders in the current column
  const currentMarkdown = page.locator('.node-box.selected .node-markdown');
  await expect(currentMarkdown).toBeVisible();
  expect(await currentMarkdown.innerHTML()).toContain('<strong>');

  // Navigate LEFT to parent level — markdown node is now in the child column
  await page.keyboard.press('ArrowLeft');
  await pause(800);

  // The markdown node should render as markdown in the child column
  const childColMarkdown = page.locator('.child-box .node-markdown').first();
  await expect(childColMarkdown).toBeVisible();
  const childColHtml = await childColMarkdown.innerHTML();
  expect(childColHtml).toContain('<strong>');
  expect(childColHtml).toContain('<em>');
});

test('issue 8: markdown renders in parent column when navigating deeper', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into children of "Welcome to Treenote"
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Edit the first child to have markdown content
  await page.keyboard.press('Enter');
  await pause(300);
  await page.locator('.node-text-input').fill('**bold** and *italic*');
  await page.keyboard.press('Escape');
  await pause(500);

  // Toggle markdown on
  await page.keyboard.press('m');
  await pause(500);

  // Add a child to this node using Meta+ArrowRight
  await page.keyboard.press('Meta+ArrowRight');
  await pause(300);
  // This enters edit mode for the new child — type something and exit
  await page.locator('.node-text-input').fill('child node');
  await page.keyboard.press('Escape');
  await pause(500);

  // Navigate RIGHT into the children of the markdown node
  await page.keyboard.press('ArrowRight');
  await pause(800);

  // The bold/italic markdown node should now render in the parent column
  const parentMarkdown = page.locator('.parent-box .node-markdown');
  await expect(parentMarkdown).toBeVisible();
  const parentHtml = await parentMarkdown.innerHTML();
  expect(parentHtml).toContain('<strong>');
  expect(parentHtml).toContain('<em>');
});
