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

const demoTree = [
  {
    text: 'Project Alpha',
    checked: false,
    children: [
      {
        text: 'Design phase',
        checked: false,
        children: [
          { text: 'Wireframes', checked: false, children: [] },
          { text: 'Color palette', checked: true, children: [] },
          { text: 'Typography', checked: false, children: [] },
        ],
      },
      {
        text: 'Build phase',
        checked: false,
        children: [
          { text: 'Frontend scaffolding', checked: false, children: [] },
          { text: 'Backend API', checked: false, children: [] },
        ],
      },
      {
        text: 'Launch',
        checked: false,
        children: [],
      },
    ],
  },
  {
    text: 'Project Beta',
    checked: false,
    children: [{ text: 'Research', checked: false, children: [] }],
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
          tree_data: demoTree,
          queue_data: null,
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

test.describe('issue-55: selected column centered on wide viewports', () => {
  test('wide viewport (2400px) centers the selected column on screen', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(400);

    // Drill in once so we have a parent column + selected + child column.
    await page.keyboard.press('ArrowRight');
    await pause(400);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const nodeListBox = await page.locator('.node-list').boundingBox();
    expect(nodeListBox).not.toBeNull();

    const nodeListCenter = nodeListBox.x + nodeListBox.width / 2;
    const screenCenter = viewportWidth / 2;

    // The center of the selected column should sit within ~10px of screen center.
    expect(Math.abs(nodeListCenter - screenCenter)).toBeLessThan(10);

    await pause(500);
  });

  test('narrow viewport (1280px) keeps the original left-aligned layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(400);

    // The viewport itself should have no extra left padding when narrower than
    // the breakpoint (2 * 660 = 1320px).
    const paddingLeft = await page.locator('.columns-viewport').evaluate(
      (el) => parseFloat(getComputedStyle(el).paddingLeft) || 0,
    );
    expect(paddingLeft).toBeLessThan(1);

    await pause(500);
  });

  test('extra-wide viewport (3200px) still centers and stays inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 3200, height: 1000 });
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(400);

    await page.keyboard.press('ArrowRight');
    await pause(400);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const nodeListBox = await page.locator('.node-list').boundingBox();
    expect(nodeListBox).not.toBeNull();

    // Selected column center is at the screen center.
    const nodeListCenter = nodeListBox.x + nodeListBox.width / 2;
    expect(Math.abs(nodeListCenter - viewportWidth / 2)).toBeLessThan(10);

    // The whole columns container fits inside the viewport horizontally.
    const columnsBox = await page.locator('.columns').boundingBox();
    expect(columnsBox.x).toBeGreaterThanOrEqual(0);
    expect(columnsBox.x + columnsBox.width).toBeLessThanOrEqual(viewportWidth + 1);

    await pause(500);
  });
});
