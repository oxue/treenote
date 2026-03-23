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

test('issue 36: default markdown setting toggle appears in settings', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Open settings with 's'
  await page.keyboard.press('s');
  await pause(500);

  // Verify the settings panel is open and contains the default markdown toggle
  const settingsPanel = page.locator('.web-settings-panel');
  await expect(settingsPanel).toBeVisible();

  const markdownLabel = settingsPanel.locator('text=Default markdown for new boxes');
  await expect(markdownLabel).toBeVisible();

  const markdownOption = settingsPanel.locator('text=New boxes default to markdown');
  await expect(markdownOption).toBeVisible();

  const plainOption = settingsPanel.locator('text=New boxes default to plain text');
  await expect(plainOption).toBeVisible();
});

test('issue 36: new boxes get markdown when default markdown is enabled', async ({ page }) => {
  await setupMocks(page);

  // Pre-set the default markdown setting in localStorage
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({
      keybindingScheme: 'arrows',
      theme: 'dark',
      enterNewline: true,
      defaultMarkdown: true,
    }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into children of the root node
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(500);

  // Insert a new sibling below with Cmd+ArrowDown
  await page.keyboard.press('Meta+ArrowDown');
  await pause(500);

  // We should be in edit mode now — type some markdown content
  const textarea = page.locator('.node-text-input');
  await textarea.fill('**bold test**');

  // Exit edit mode
  await page.keyboard.press('Escape');
  await pause(500);

  // The new node should have the MD badge since defaultMarkdown is enabled
  const badge = page.locator('.node-box.selected .markdown-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('MD');

  // The markdown should be rendered as HTML
  const markdownHtml = await page.locator('.node-box.selected .node-markdown').innerHTML();
  expect(markdownHtml).toContain('<strong>');
});

test('issue 36: new boxes stay plain text when default markdown is off', async ({ page }) => {
  await setupMocks(page);

  // Ensure default markdown is off
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({
      keybindingScheme: 'arrows',
      theme: 'dark',
      enterNewline: true,
      defaultMarkdown: false,
    }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into children
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(500);

  // Insert a new sibling below
  await page.keyboard.press('Meta+ArrowDown');
  await pause(500);

  // Type markdown content
  const textarea = page.locator('.node-text-input');
  await textarea.fill('**not bold**');

  // Exit edit mode
  await page.keyboard.press('Escape');
  await pause(500);

  // No MD badge should be present
  const badge = page.locator('.node-box.selected .markdown-badge');
  await expect(badge).not.toBeVisible();

  // Text should be rendered as plain text with asterisks visible
  const plainText = await page.locator('.node-box.selected .node-text').textContent();
  expect(plainText).toContain('**not bold**');
});
