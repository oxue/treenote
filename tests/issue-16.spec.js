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
  // Mock all Supabase auth endpoints
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

test('issue 16: markdown in selected column has no extra whitespace', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into children of "Welcome to Treenote"
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Edit the first child to have multi-line markdown content
  await page.keyboard.press('Enter');
  await pause(300);
  await page.locator('.node-text-input').fill('# Heading\n\nSome **bold** text\n\n- item 1\n- item 2');
  await page.keyboard.press('Escape');
  await pause(500);

  // Toggle markdown on
  await page.keyboard.press('m');
  await pause(500);

  // Verify markdown renders in the selected node
  const markdownNode = page.locator('.node-box.selected .node-markdown');
  await expect(markdownNode).toBeVisible();

  // Check that white-space is 'normal' (not 'pre-wrap') on the markdown element
  const whiteSpace = await markdownNode.evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(whiteSpace).toBe('normal');

  // The rendered HTML should contain proper markdown elements, not raw text with extra spaces
  const html = await markdownNode.innerHTML();
  expect(html).toContain('<h1>');
  expect(html).toContain('<strong>');
  expect(html).toContain('<li>');

  // Verify no excessive vertical gaps: the box height should be reasonable
  // (with pre-wrap, blank lines between HTML tags create extra whitespace)
  const boxHeight = await markdownNode.evaluate((el) => el.getBoundingClientRect().height);
  // A heading + paragraph + 2-item list should be compact (well under 300px)
  expect(boxHeight).toBeLessThan(300);
});
