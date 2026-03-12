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

test('issue 23: horizontal rule renders full width in markdown nodes', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into children
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Edit the node to contain a horizontal rule using ***
  await page.keyboard.press('Enter');
  await pause(300);
  await page.locator('.node-text-input').fill('Above the line\n\n***\n\nBelow the line');
  await page.keyboard.press('Escape');
  await pause(500);

  // Toggle markdown on
  await page.keyboard.press('m');
  await pause(500);

  // Verify markdown renders with an <hr> element
  const markdownNode = page.locator('.node-box.selected .node-markdown');
  await expect(markdownNode).toBeVisible();

  const html = await markdownNode.innerHTML();
  expect(html).toContain('<hr');

  // The <hr> should span the full width of its container
  const hrWidth = await markdownNode.evaluate((el) => {
    const hr = el.querySelector('hr');
    const container = el;
    return {
      hrWidth: hr.getBoundingClientRect().width,
      containerWidth: container.getBoundingClientRect().width,
    };
  });

  // The hr should be at least 90% of the container width (full width minus any minor rounding)
  expect(hrWidth.hrWidth).toBeGreaterThan(hrWidth.containerWidth * 0.9);
  // Container should have meaningful width (not collapsed inline)
  expect(hrWidth.containerWidth).toBeGreaterThan(100);
});
