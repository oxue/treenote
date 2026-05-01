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
        ],
      },
      {
        text: 'Build phase',
        checked: false,
        children: [
          { text: 'Frontend scaffolding', checked: false, children: [] },
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

async function presetBoxWidth(page, width) {
  await page.addInitScript((w) => {
    const STORAGE_KEY = 'treenote-settings';
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, boxWidth: w }));
  }, width);
}

async function measureCentering(page) {
  await page.keyboard.press('ArrowRight');
  await pause(500);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const nodeListBox = await page.locator('.node-list').boundingBox();
  expect(nodeListBox).not.toBeNull();
  const nodeListCenter = nodeListBox.x + nodeListBox.width / 2;
  return { viewportWidth, nodeListCenter, nodeListBox };
}

test.describe('issue-59: selected column stays centered with adjustable box widths', () => {
  test('default 400px box width centers correctly', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(400);

    const { viewportWidth, nodeListCenter, nodeListBox } = await measureCentering(page);
    expect(Math.round(nodeListBox.width)).toBe(400);
    expect(Math.abs(nodeListCenter - viewportWidth / 2)).toBeLessThan(10);
    await pause(500);
  });

  test('larger 600px box width still centers correctly', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await setupMocks(page);
    await presetBoxWidth(page, 600);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(500);

    const nodeListWidth = await page.evaluate(
      () => parseFloat(getComputedStyle(document.querySelector('.node-list')).width)
    );
    expect(Math.round(nodeListWidth)).toBe(600);

    const { viewportWidth, nodeListCenter } = await measureCentering(page);
    expect(Math.abs(nodeListCenter - viewportWidth / 2)).toBeLessThan(10);
    await pause(500);
  });

  test('smaller 280px box width still centers correctly', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await setupMocks(page);
    await presetBoxWidth(page, 280);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(500);

    const nodeListWidth = await page.evaluate(
      () => parseFloat(getComputedStyle(document.querySelector('.node-list')).width)
    );
    expect(Math.round(nodeListWidth)).toBe(280);

    const { viewportWidth, nodeListCenter } = await measureCentering(page);
    expect(Math.abs(nodeListCenter - viewportWidth / 2)).toBeLessThan(10);
    await pause(500);
  });

  test('changing box width via settings re-centers selected column', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForSelector('.node-box', { timeout: 10000 });
    await pause(400);

    await page.keyboard.press('ArrowRight');
    await pause(400);

    // Open settings.
    await page.keyboard.press('s');
    await pause(400);
    await page.click('.web-settings-tab:has-text("Appearance")');
    await pause(300);

    // Set width to 560 via the number input.
    const numberInput = page.locator('input.box-width-input');
    await numberInput.fill('560');
    await numberInput.dispatchEvent('change');
    await pause(400);

    await page.keyboard.press('Escape');
    await pause(400);

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const nodeListBox = await page.locator('.node-list').boundingBox();
    expect(nodeListBox).not.toBeNull();
    expect(Math.round(nodeListBox.width)).toBe(560);

    const nodeListCenter = nodeListBox.x + nodeListBox.width / 2;
    expect(Math.abs(nodeListCenter - viewportWidth / 2)).toBeLessThan(10);
    await pause(500);
  });
});
