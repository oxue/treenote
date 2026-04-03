import { test } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const SUPABASE_URL = 'https://etfkdcsoazbxiqzsjkrh.supabase.co';
const OUTPUT_DIR = '/Users/oliverxu/Desktop/treenote-media';

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

// Rich demo tree data with deadlines, checked items, priorities, and deep nesting
const demoTree = [
  {
    text: 'Launch Plan',
    checked: false,
    children: [
      {
        text: 'Build landing page',
        checked: true,
        deadline: '2026-03-10',
        children: [
          { text: 'Hero section copy', checked: true, children: [] },
          { text: 'Feature screenshots', checked: false, children: [] },
          { text: 'Pricing table', checked: true, children: [] },
        ],
      },
      {
        text: 'Reddit launch post',
        checked: false,
        deadline: '2026-03-14',
        priority: 'high',
        children: [
          { text: 'Write post draft', checked: false, children: [] },
          { text: 'Record demo GIF', checked: false, children: [] },
          { text: 'Choose subreddit', checked: true, children: [] },
        ],
      },
      {
        text: 'Fix critical bugs',
        checked: false,
        priority: 'high',
        deadline: '2026-03-13',
        children: [
          { text: 'Mobile viewport issue', checked: true, children: [] },
          { text: 'Auth redirect loop', checked: true, children: [] },
        ],
      },
      {
        text: 'Set up analytics',
        checked: false,
        children: [],
      },
      {
        text: 'Write documentation',
        checked: false,
        children: [
          { text: 'Getting started guide', checked: false, children: [] },
          { text: 'Keyboard shortcuts reference', checked: false, children: [] },
          { text: 'API docs for calendar feed', checked: false, children: [] },
        ],
      },
    ],
  },
  {
    text: 'Product Ideas',
    checked: false,
    children: [
      { text: 'Collaborative editing', checked: false, children: [] },
      { text: 'Mobile app', checked: false, children: [] },
      { text: 'Browser extension', checked: false, children: [] },
    ],
  },
  {
    text: 'Weekly Review',
    checked: false,
    deadline: '2026-03-15',
    children: [
      { text: 'Review OKRs', checked: false, children: [] },
      { text: 'Update roadmap', checked: false, children: [] },
    ],
  },
];

// Queue items for demo
const demoQueue = [
  { text: 'Reply to beta tester feedback', type: 'temp', checked: false },
  { text: 'Deploy v1.2 hotfix', type: 'temp', checked: false, deadline: '2026-03-13', priority: 'high' },
  { text: 'Review PR #42', type: 'temp', checked: false },
];

async function setupMocks(page, { withTree = true, withQueue = false } = {}) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSession),
    });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/user_trees*`, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'GET') {
      // .single() expects a single object, not an array
      // Check if it's selecting queue_data or tree_data based on the select param
      const responseData = {
        tree_data: withTree ? demoTree : null,
        queue_data: withQueue ? demoQueue : null,
        version: 1,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Supabase .single() with Accept: application/vnd.pgrst.object+json returns object
        // But Supabase client sends that header automatically. Return the object directly.
        body: JSON.stringify(responseData),
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: 2 }),
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

// ─────────────────────────────────────────────────
// Asset 1: Hero screenshot (dark theme)
// ─────────────────────────────────────────────────
test('Asset 1: hero-dark.png', async ({ page }) => {
  await setupMocks(page, { withTree: true, withQueue: true });

  // Set dark theme in localStorage before navigating
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'arrows', theme: 'dark' }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(1000);

  // Navigate into "Launch Plan" children to show the 3-column view
  await page.keyboard.press('ArrowRight');
  await pause(600);

  // Select "Reddit launch post" (second child) for a nice view with deadline + priority
  await page.keyboard.press('ArrowDown');
  await pause(400);

  await page.screenshot({ path: `${OUTPUT_DIR}/hero-dark.png`, fullPage: true });
});

// ─────────────────────────────────────────────────
// Asset 2: Hero screenshot (midnight theme)
// ─────────────────────────────────────────────────
test('Asset 2: hero-midnight.png', async ({ page }) => {
  await setupMocks(page, { withTree: true, withQueue: true });

  // Set midnight theme
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'arrows', theme: 'midnight' }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(1000);

  // Navigate into "Launch Plan" children
  await page.keyboard.press('ArrowRight');
  await pause(600);

  // Select "Reddit launch post"
  await page.keyboard.press('ArrowDown');
  await pause(400);

  await page.screenshot({ path: `${OUTPUT_DIR}/hero-midnight.png`, fullPage: true });
});

// ─────────────────────────────────────────────────
// Asset 3: Physics eject GIF
// ─────────────────────────────────────────────────
test('Asset 3: physics-eject.gif', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: '/tmp/treenote-videos-eject', size: { width: 1400, height: 900 } },
  });
  const page = await context.newPage();

  await setupMocks(page, { withTree: true, withQueue: false });

  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'arrows', theme: 'dark' }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(1000);

  // Navigate into "Launch Plan" children
  await page.keyboard.press('ArrowRight');
  await pause(600);

  // Add items to queue: press 'q' on several items
  // First item "Build landing page"
  await page.keyboard.press('q');
  await pause(400);

  // Move down and add "Reddit launch post"
  await page.keyboard.press('ArrowDown');
  await pause(300);
  await page.keyboard.press('q');
  await pause(400);

  // Move down and add "Fix critical bugs"
  await page.keyboard.press('ArrowDown');
  await pause(300);
  await page.keyboard.press('q');
  await pause(400);

  // Move down and add "Set up analytics"
  await page.keyboard.press('ArrowDown');
  await pause(300);
  await page.keyboard.press('q');
  await pause(400);

  await pause(500);

  // Navigate to the top of the list first (ArrowUp until at index 0)
  await page.keyboard.press('ArrowUp');
  await pause(300);
  await page.keyboard.press('ArrowUp');
  await pause(300);
  await page.keyboard.press('ArrowUp');
  await pause(300);
  await page.keyboard.press('ArrowUp');
  await pause(300);

  // Now press ArrowUp one more time to enter queue focus (at index 0, ArrowUp enters queue)
  await page.keyboard.press('ArrowUp');
  await pause(800);

  // Check off items by pressing 'c' — each ejects with physics animation
  await page.keyboard.press('c');
  await pause(1200);

  await page.keyboard.press('c');
  await pause(1200);

  await page.keyboard.press('c');
  await pause(2000); // Extra wait for final animation to complete

  await pause(500);

  await context.close();

  // Find the video file and convert to gif with high quality palette
  await pause(1000);
  try {
    const videoFiles = execSync('ls -t /tmp/treenote-videos-eject/*.webm 2>/dev/null').toString().trim().split('\n');
    if (videoFiles.length > 0 && videoFiles[0]) {
      const input = videoFiles[0];
      // Two-pass gif with palette for much better quality
      execSync(`ffmpeg -y -i "${input}" -vf "fps=30,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${OUTPUT_DIR}/physics-eject.gif"`, { timeout: 60000 });
    }
  } catch (e) {
    console.log('Video conversion note:', e.message);
  }
});

// ─────────────────────────────────────────────────
// Asset 4: Vim navigation GIF
// ─────────────────────────────────────────────────
test('Asset 4: vim-navigation.gif', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: '/tmp/treenote-videos-vim', size: { width: 1400, height: 900 } },
  });
  const page = await context.newPage();

  await setupMocks(page, { withTree: true, withQueue: false });

  // Set vim keybindings
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'vim', theme: 'dark' }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(1200);

  // Navigate with vim keys: j,j to move down
  await page.keyboard.press('j');
  await pause(500);
  await page.keyboard.press('j');
  await pause(500);

  // l to drill into children
  await page.keyboard.press('l');
  await pause(700);

  // j,j to move down within children
  await page.keyboard.press('j');
  await pause(500);
  await page.keyboard.press('j');
  await pause(500);

  // Enter to edit
  await page.keyboard.press('Enter');
  await pause(600);

  // Type something
  await page.keyboard.type('vim is awesome!', { delay: 60 });
  await pause(500);

  // Escape to exit edit
  await page.keyboard.press('Escape');
  await pause(600);

  // k,k to go back up
  await page.keyboard.press('k');
  await pause(500);
  await page.keyboard.press('k');
  await pause(500);

  // h to go back to parent
  await page.keyboard.press('h');
  await pause(700);

  await pause(1000);

  await context.close();

  // Convert to gif with high quality palette
  await pause(1000);
  try {
    const videoFiles = execSync('ls -t /tmp/treenote-videos-vim/*.webm 2>/dev/null').toString().trim().split('\n');
    if (videoFiles.length > 0 && videoFiles[0]) {
      const input = videoFiles[0];
      execSync(`ffmpeg -y -i "${input}" -vf "fps=30,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${OUTPUT_DIR}/vim-navigation.gif"`, { timeout: 60000 });
    }
  } catch (e) {
    console.log('Video conversion note:', e.message);
  }
});

// ─────────────────────────────────────────────────
// Asset 5: Settings panel screenshots
// ─────────────────────────────────────────────────
test('Asset 5: settings screenshots', async ({ page }) => {
  await setupMocks(page, { withTree: true });

  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'vim', theme: 'dark' }));
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(800);

  // Open settings with 's' key
  await page.keyboard.press('s');
  await pause(800);

  // Should be on keybindings tab by default
  await page.waitForSelector('.web-settings-panel', { timeout: 5000 });
  await pause(400);

  await page.screenshot({ path: `${OUTPUT_DIR}/settings-keybindings.png`, fullPage: true });

  // Switch to theme tab - press ArrowRight or Tab
  await page.keyboard.press('ArrowRight');
  await pause(600);

  await page.screenshot({ path: `${OUTPUT_DIR}/settings-themes.png`, fullPage: true });
});

// ─────────────────────────────────────────────────
// Asset 6: Login page screenshot
// ─────────────────────────────────────────────────
test('Asset 6: login-page.png', async ({ page }) => {
  // Do NOT set up auth mocks - let login page show
  // But we need to intercept Supabase auth calls to prevent actual network requests
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    // Return empty/unauthorized to show login page
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized' }),
    });
  });

  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Set dark theme
  await page.addInitScript(() => {
    localStorage.setItem('treenote-settings', JSON.stringify({ keybindingScheme: 'arrows', theme: 'dark' }));
  });

  await page.goto('http://localhost:5173');

  // Wait for login page to render
  await page.waitForSelector('.login-page', { timeout: 15000 });
  await pause(2000); // Let animations play

  await page.screenshot({ path: `${OUTPUT_DIR}/login-page.png`, fullPage: true });
});
