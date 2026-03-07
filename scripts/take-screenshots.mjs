import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const screenshotsDir = join(rootDir, 'screenshots');
const fixturesDir = join(__dirname, 'fixtures');

const sampleTree = JSON.parse(readFileSync(join(fixturesDir, 'sample-tree.json'), 'utf-8'));
const sampleQueue = JSON.parse(readFileSync(join(fixturesDir, 'sample-queue.json'), 'utf-8'));

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000000';
const FAKE_SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: FAKE_USER_ID,
    email: 'test@treenote.dev',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Test User' },
    aud: 'authenticated',
    role: 'authenticated',
  },
};

const requestedStates = process.argv.slice(2);

mkdirSync(screenshotsDir, { recursive: true });

// Build first
console.log('Building app...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// Start preview server
console.log('Starting preview server...');
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
  cwd: rootDir,
  stdio: 'pipe',
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000);
  const handler = (data) => {
    if (data.toString().includes('4174')) {
      clearTimeout(timeout);
      resolve();
    }
  };
  server.stdout.on('data', handler);
  server.stderr.on('data', handler);
});

console.log('Server ready on port 4174');

const browser = await chromium.launch();

try {
  // --- State: Login Page (no mocking needed) ---
  if (shouldCapture('login-page')) {
    console.log('Capturing: login-page');
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto('http://localhost:4174');
    await page.waitForSelector('.login-card');
    await page.screenshot({ path: join(screenshotsDir, 'login-page.png') });
    await page.close();
  }

  // --- Helper: create an authenticated page with mocked Supabase ---
  async function createAuthenticatedPage(treeData, queueData = []) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const storageKey = 'sb-etfkdcsoazbxiqzsjkrh-auth-token';

    // Intercept ALL Supabase requests
    await page.route('**supabase.co/**', (route, request) => {
      const url = request.url();
      const method = request.method();

      // Auth: getSession / refreshSession / getUser
      if (url.includes('/auth/v1/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(FAKE_SESSION),
        });
      }

      // REST API: tree/queue reads
      if (url.includes('/rest/v1/user_trees')) {
        if (method === 'GET') {
          if (url.includes('select=tree_data')) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ tree_data: treeData }),
            });
          }
          if (url.includes('select=queue_data')) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ queue_data: queueData }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ tree_data: treeData, queue_data: queueData }),
          });
        }
        // Writes
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }

      // Fallback: let it through
      return route.continue();
    });

    // Navigate first to set localStorage on the correct origin
    await page.goto('http://localhost:4174');

    // Inject session into localStorage (supabase-js reads this)
    await page.evaluate(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    }, {
      key: storageKey,
      session: {
        access_token: FAKE_SESSION.access_token,
        refresh_token: FAKE_SESSION.refresh_token,
        expires_in: FAKE_SESSION.expires_in,
        expires_at: FAKE_SESSION.expires_at,
        token_type: FAKE_SESSION.token_type,
        user: FAKE_SESSION.user,
      },
    });

    // Reload — app will read session from localStorage, API calls are mocked
    await page.reload();
    await page.waitForTimeout(1500);

    return page;
  }

  // --- State: Main Tree View ---
  if (shouldCapture('main-tree')) {
    console.log('Capturing: main-tree');
    const page = await createAuthenticatedPage(sampleTree, []);
    try {
      await page.waitForSelector('.node-box', { timeout: 8000 });
    } catch {
      console.log('  (node-box not found, capturing current state anyway)');
    }
    await page.screenshot({ path: join(screenshotsDir, 'main-tree.png') });
    await page.close();
  }

  // --- State: Tree with children (drilled in) ---
  if (shouldCapture('tree-with-children')) {
    console.log('Capturing: tree-with-children');
    const page = await createAuthenticatedPage(sampleTree, []);
    try {
      await page.waitForSelector('.node-box', { timeout: 8000 });
      await page.click('.node-box');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
    } catch {
      console.log('  (interaction failed, capturing current state)');
    }
    await page.screenshot({ path: join(screenshotsDir, 'tree-with-children.png') });
    await page.close();
  }

  // --- State: Queue bar with items ---
  if (shouldCapture('queue-bar')) {
    console.log('Capturing: queue-bar');
    const page = await createAuthenticatedPage(sampleTree, sampleQueue);
    try {
      await page.waitForSelector('.node-box', { timeout: 8000 });
      await page.waitForTimeout(500);
    } catch {
      console.log('  (waiting for render, capturing current state)');
    }
    await page.screenshot({ path: join(screenshotsDir, 'queue-bar.png') });
    await page.close();
  }

  // --- State: Empty state ---
  if (shouldCapture('empty-state')) {
    console.log('Capturing: empty-state');
    const page = await createAuthenticatedPage(null, []);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(screenshotsDir, 'empty-state.png') });
    await page.close();
  }

  console.log('\nAll screenshots saved to screenshots/');

} finally {
  await browser.close();
  server.kill();
}

function shouldCapture(name) {
  if (requestedStates.length === 0) return true;
  return requestedStates.includes(name);
}
