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

test('issue 29: swap nodes with shift key has tweening animation', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');

  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });

  // Navigate into the default "Welcome" node's children to get multiple nodes
  await page.keyboard.press('ArrowRight');
  await page.waitForSelector('.node-box.selected');
  await pause(800);

  // Create a second sibling node so we have something to swap with
  await page.keyboard.press('Meta+ArrowDown');
  await pause(300);
  await page.locator('.node-text-input').fill('Swap Target');
  await page.keyboard.press('Escape');
  await pause(500);

  // We should now have at least 2 nodes
  const nodesAfter = await page.locator('.node-box').count();
  expect(nodesAfter).toBeGreaterThanOrEqual(2);

  // The selected node should be "Swap Target" (just created + edited)
  const selectedText = await page.locator('.node-box.selected').innerText();
  expect(selectedText).toContain('Swap Target');

  // Record the position of the selected node before swapping up
  const selectedBefore = await page.locator('.node-box.selected').boundingBox();

  // Set up a MutationObserver to detect the animation
  await page.evaluate(() => {
    window.__swapAnimationDetected = false;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'style' && m.target.classList.contains('node-box')) {
          if (m.target.style.transition.includes('transform')) {
            window.__swapAnimationDetected = true;
          }
        }
      }
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    window.__swapObserver = observer;
  });

  // Swap up with Shift+ArrowUp — this should trigger a tweening animation
  await page.keyboard.press('Shift+ArrowUp');
  await pause(100);

  const hasTransition = await page.evaluate(() => {
    window.__swapObserver?.disconnect();
    return window.__swapAnimationDetected;
  });
  expect(hasTransition).toBe(true);

  // Wait for animation to complete
  await pause(400);

  // Verify the swap actually happened — selected node moved up
  const selectedAfter = await page.locator('.node-box.selected').boundingBox();
  expect(selectedAfter.y).toBeLessThan(selectedBefore.y);

  // Verify transitions are cleaned up after animation
  const transitionAfter = await page.locator('.node-box.selected').evaluate((el) => {
    return el.style.transition;
  });
  expect(transitionAfter).toBe('');

  // Test swap down as well
  await page.evaluate(() => {
    window.__swapAnimationDetected = false;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'style' && m.target.classList.contains('node-box')) {
          if (m.target.style.transition.includes('transform')) {
            window.__swapAnimationDetected = true;
          }
        }
      }
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    window.__swapObserver = observer;
  });

  const selectedBeforeDown = await page.locator('.node-box.selected').boundingBox();
  await page.keyboard.press('Shift+ArrowDown');
  await pause(100);

  const hasTransitionDown = await page.evaluate(() => {
    window.__swapObserver?.disconnect();
    return window.__swapAnimationDetected;
  });
  expect(hasTransitionDown).toBe(true);

  // Wait for animation to complete
  await pause(400);

  const selectedAfterDown = await page.locator('.node-box.selected').boundingBox();
  expect(selectedAfterDown.y).toBeGreaterThan(selectedBeforeDown.y);
});
