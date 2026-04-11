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

test('issue 47: breadcrumbs show first line only and escape markdown', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // The default tree has "Welcome to Treenote" as root with children.
  // Navigate into it by pressing Enter/Right to drill down.
  await page.keyboard.press('ArrowRight');
  await pause(500);

  // Now breadcrumbs should be visible
  const breadcrumb = page.locator('.breadcrumb');
  await expect(breadcrumb).toBeVisible({ timeout: 5000 });

  // Breadcrumb text should not contain markdown formatting characters
  const breadcrumbText = await breadcrumb.textContent();
  console.log('breadcrumb text:', breadcrumbText);

  // Each breadcrumb item should only show plain text (no markdown syntax)
  const items = page.locator('.breadcrumb-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).textContent();
    console.log(`breadcrumb item ${i}:`, JSON.stringify(text));

    // Should not contain raw markdown formatting
    expect(text).not.toMatch(/^#{1,6}\s/);       // no heading markers
    expect(text).not.toMatch(/\*\*.+\*\*/);       // no bold markers
    expect(text).not.toMatch(/\[.+\]\(.+\)/);     // no link syntax
    expect(text).not.toMatch(/`[^`]+`/);           // no inline code

    // Should not contain newlines (first line only)
    expect(text).not.toContain('\n');
  }

  // Now let's create a node with markdown and multi-line text, then navigate into it
  // to verify breadcrumbs strip formatting from user content too.
  // Go back to root first
  await page.keyboard.press('ArrowLeft');
  await pause(500);

  // Create a new node with markdown text
  await page.keyboard.press('o');  // create sibling below
  await pause(300);

  // Type markdown-formatted multi-line text
  await page.keyboard.type('# Heading Node');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second line of text');
  await pause(300);

  // Exit edit mode
  await page.keyboard.press('Escape');
  await pause(300);

  // Add a child to this node so we can navigate into it
  await page.keyboard.press('Tab');  // indent to make it a child... or create child
  await pause(300);

  // Create a child node
  await page.keyboard.press('o');
  await pause(300);
  await page.keyboard.type('child node');
  await page.keyboard.press('Escape');
  await pause(300);

  // Navigate into the parent to see breadcrumbs
  // First go up to the parent
  await page.keyboard.press('ArrowUp');
  await pause(300);

  // Drill into it
  await page.keyboard.press('ArrowRight');
  await pause(500);

  // Check breadcrumbs again
  const breadcrumb2 = page.locator('.breadcrumb');
  await expect(breadcrumb2).toBeVisible({ timeout: 5000 });

  const items2 = page.locator('.breadcrumb-item');
  const count2 = await items2.count();
  for (let i = 0; i < count2; i++) {
    const text = await items2.nth(i).textContent();
    console.log(`breadcrumb2 item ${i}:`, JSON.stringify(text));

    // Should not contain heading markers
    expect(text).not.toMatch(/^#/);
    // Should not contain newlines
    expect(text).not.toContain('\n');
    // Should not contain "second line"
    expect(text).not.toContain('second line');
  }
});
