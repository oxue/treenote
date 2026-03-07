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

test('issue 5: toggle markdown mode with m key renders markdown in visual mode', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into the "Welcome to Treenote" children
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Edit the first node to have markdown content
  await page.keyboard.press('Enter');
  await pause(300);
  const textarea = page.locator('.node-text-input');
  await textarea.fill('**bold text** and *italic*');
  await page.keyboard.press('Escape');
  await pause(500);

  // Verify the text is rendered as plain text (no HTML tags)
  const plainText = await page.locator('.node-box.selected .node-text').textContent();
  expect(plainText).toContain('**bold text**');

  // Toggle markdown mode with 'm'
  await page.keyboard.press('m');
  await pause(500);

  // Verify the MD badge appears
  const badge = page.locator('.node-box.selected .markdown-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('MD');

  // Verify the markdown is rendered as HTML (bold and italic tags)
  const markdownHtml = await page.locator('.node-box.selected .node-markdown').innerHTML();
  expect(markdownHtml).toContain('<strong>');
  expect(markdownHtml).toContain('<em>');

  // Enter edit mode — should show raw markdown in textarea
  await page.keyboard.press('Enter');
  await pause(300);
  const editTextarea = page.locator('.node-text-input');
  const editValue = await editTextarea.inputValue();
  expect(editValue).toContain('**bold text**');
  expect(editValue).toContain('*italic*');

  // Exit edit mode — markdown should render again
  await page.keyboard.press('Escape');
  await pause(500);

  const renderedAgain = await page.locator('.node-box.selected .node-markdown').innerHTML();
  expect(renderedAgain).toContain('<strong>');

  // Toggle markdown off with 'm' again
  await page.keyboard.press('m');
  await pause(500);

  // MD badge should disappear and text should be plain again
  await expect(page.locator('.node-box.selected .markdown-badge')).not.toBeVisible();
  const plainAgain = await page.locator('.node-box.selected .node-text').textContent();
  expect(plainAgain).toContain('**bold text**');
});

test('issue 5: markdown toggle hotkey shown in legend', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 10000 });

  const legendText = await page.locator('.hotkey-legend').textContent();
  expect(legendText).toContain('Toggle markdown');
});
