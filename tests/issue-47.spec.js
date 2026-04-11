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

// Tree with markdown-formatted nodes to verify breadcrumb stripping
const markdownTree = [
  {
    text: '# Project Overview\nThis is the second line',
    checked: false,
    children: [
      {
        text: '**Bold Task** with extra info',
        checked: false,
        children: [
          { text: 'plain leaf', checked: false, children: [] },
        ],
      },
      {
        text: '[Link Text](https://example.com)',
        checked: false,
        children: [
          { text: 'another leaf', checked: false, children: [] },
        ],
      },
      {
        text: '`inline code` node\nline two here',
        checked: false,
        children: [
          { text: 'deep leaf', checked: false, children: [] },
        ],
      },
      {
        text: '## Sub-heading with ~~strikethrough~~',
        checked: false,
        children: [
          { text: 'child', checked: false, children: [] },
        ],
      },
    ],
  },
];

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
        body: JSON.stringify({
          tree_data: markdownTree,
          version: 1,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: 2 }),
      });
    }
  });

  await page.route(`${SUPABASE_URL}/rest/v1/user_queues*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ queue_data: null, version: 1 }),
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

  // The tree root is "# Project Overview\nThis is the second line"
  // Navigate into it to see breadcrumbs
  await page.keyboard.press('ArrowRight');
  await pause(500);

  // Breadcrumbs should be visible — root crumb should be stripped
  const breadcrumb = page.locator('.breadcrumb');
  await expect(breadcrumb).toBeVisible({ timeout: 5000 });

  // Check root breadcrumb item: should show "Project Overview", not "# Project Overview"
  const items = page.locator('.breadcrumb-item');
  const rootText = await items.first().textContent();
  console.log('root breadcrumb:', JSON.stringify(rootText));

  // Must not contain heading marker or second line
  expect(rootText).not.toMatch(/^#/);
  expect(rootText).not.toContain('second line');
  expect(rootText).toContain('Project Overview');

  // Now drill into the bold child: "**Bold Task** with extra info"
  await page.keyboard.press('ArrowRight');
  await pause(500);

  const items2 = page.locator('.breadcrumb-item');
  const count2 = await items2.count();
  // The last non-current crumb should be the bold node, stripped
  for (let i = 0; i < count2; i++) {
    const text = await items2.nth(i).textContent();
    console.log(`breadcrumb item ${i}:`, JSON.stringify(text));

    // No markdown syntax in any breadcrumb
    expect(text).not.toMatch(/\*\*/);
    expect(text).not.toMatch(/^#{1,6}\s/);
    expect(text).not.toMatch(/\[.+\]\(.+\)/);
    expect(text).not.toMatch(/`[^`]+`/);
    expect(text).not.toMatch(/~~/);
    expect(text).not.toContain('\n');
  }

  // Go back and navigate into the link node
  await page.keyboard.press('ArrowLeft');
  await pause(300);
  await page.keyboard.press('ArrowDown'); // move to link node
  await pause(300);
  await page.keyboard.press('ArrowRight'); // drill in
  await pause(500);

  const linkCrumbs = page.locator('.breadcrumb-item');
  const linkCount = await linkCrumbs.count();
  for (let i = 0; i < linkCount; i++) {
    const text = await linkCrumbs.nth(i).textContent();
    console.log(`link breadcrumb ${i}:`, JSON.stringify(text));
    expect(text).not.toMatch(/\[.+\]\(.+\)/);
    expect(text).not.toContain('https://');
  }

  // Go back and navigate into the inline code node
  await page.keyboard.press('ArrowLeft');
  await pause(300);
  await page.keyboard.press('ArrowDown'); // move to code node
  await pause(300);
  await page.keyboard.press('ArrowRight'); // drill in
  await pause(500);

  const codeCrumbs = page.locator('.breadcrumb-item');
  const codeCount = await codeCrumbs.count();
  for (let i = 0; i < codeCount; i++) {
    const text = await codeCrumbs.nth(i).textContent();
    console.log(`code breadcrumb ${i}:`, JSON.stringify(text));
    expect(text).not.toMatch(/`[^`]+`/);
    expect(text).not.toContain('line two');
  }

  // Go back and navigate into the sub-heading + strikethrough node
  await page.keyboard.press('ArrowLeft');
  await pause(300);
  await page.keyboard.press('ArrowDown'); // move to sub-heading node
  await pause(300);
  await page.keyboard.press('ArrowRight'); // drill in
  await pause(500);

  const headCrumbs = page.locator('.breadcrumb-item');
  const headCount = await headCrumbs.count();
  for (let i = 0; i < headCount; i++) {
    const text = await headCrumbs.nth(i).textContent();
    console.log(`heading breadcrumb ${i}:`, JSON.stringify(text));
    expect(text).not.toMatch(/^##/);
    expect(text).not.toMatch(/~~/);
  }
});
