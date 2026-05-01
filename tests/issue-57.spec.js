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

const testTree = [
  {
    text: 'Root',
    checked: false,
    children: [
      {
        text: 'Alpha',
        checked: false,
        children: [
          { text: 'A-child-1', checked: false, children: [] },
          { text: 'A-child-2', checked: false, children: [] },
        ],
      },
      { text: 'Beta', checked: false, children: [] },
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
          tree_data: testTree,
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

async function getNodeListWidth(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.node-list');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return parseFloat(cs.width);
  });
}

async function getQueueItemWidth(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.queue-item');
    if (!el) return null;
    return el.getBoundingClientRect().width;
  });
}

test('issue-57: tree box width is adjustable from settings, queue width unchanged', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Send a node to the queue so we can verify queue width is unaffected.
  // First navigate into Root to expose Alpha/Beta in current column.
  await page.keyboard.press('ArrowRight');
  await pause(500);
  // Press q to enqueue Alpha.
  await page.keyboard.press('q');
  await pause(400);
  await page.waitForSelector('.queue-item', { timeout: 5000 });

  const initialNodeWidth = await getNodeListWidth(page);
  const initialQueueWidth = await getQueueItemWidth(page);
  expect(initialNodeWidth).toBeGreaterThan(0);
  expect(initialQueueWidth).toBeGreaterThan(0);
  // Sanity: default is 400.
  expect(Math.round(initialNodeWidth)).toBe(400);

  // Open settings (s)
  await page.keyboard.press('s');
  await pause(400);
  await page.waitForSelector('.web-settings-panel', { timeout: 5000 });

  // Click the Appearance tab.
  await page.click('.web-settings-tab:has-text("Appearance")');
  await pause(300);

  // Verify slider + number input both present.
  await page.waitForSelector('input.box-width-slider', { timeout: 3000 });
  await page.waitForSelector('input.box-width-input', { timeout: 3000 });

  // Change box width via the number input to a larger value.
  const numberInput = page.locator('input.box-width-input');
  await numberInput.fill('560');
  await numberInput.dispatchEvent('change');
  await pause(400);

  // Close the settings panel.
  await page.keyboard.press('Escape');
  await pause(400);

  const afterNodeWidth = await getNodeListWidth(page);
  const afterQueueWidth = await getQueueItemWidth(page);

  // Tree column should now be 560px wide.
  expect(Math.round(afterNodeWidth)).toBe(560);
  // Queue width must NOT change.
  expect(Math.abs(afterQueueWidth - initialQueueWidth)).toBeLessThan(1);

  // Now test the slider: open settings again, drag slider to a smaller value.
  await page.keyboard.press('s');
  await pause(400);
  await page.click('.web-settings-tab:has-text("Appearance")');
  await pause(300);

  // Use the slider via fill (range inputs accept numeric values).
  const slider = page.locator('input.box-width-slider');
  await slider.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, '320');
  await pause(400);

  // Number input should reflect the slider's new value.
  const numberValue = await page.locator('input.box-width-input').inputValue();
  expect(numberValue).toBe('320');

  await page.keyboard.press('Escape');
  await pause(400);

  const finalNodeWidth = await getNodeListWidth(page);
  const finalQueueWidth = await getQueueItemWidth(page);
  expect(Math.round(finalNodeWidth)).toBe(320);
  // Queue still unaffected.
  expect(Math.abs(finalQueueWidth - initialQueueWidth)).toBeLessThan(1);

  // Verify the setting persists across reload.
  await page.reload();
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);
  const reloadedNodeWidth = await getNodeListWidth(page);
  expect(Math.round(reloadedNodeWidth)).toBe(320);

  // Brief pause so video captures final state
  await pause(500);
});
