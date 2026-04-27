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

// Tree where root has multiple children, and the first one has its own children
// so that when we navigate into root, the selected node draws right-side lines.
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
      {
        text: 'Beta',
        checked: false,
        children: [
          { text: 'B-child-1', checked: false, children: [] },
        ],
      },
      {
        text: 'Gamma',
        checked: false,
        children: [],
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

test('issue-53: connector lines redraw to follow swapped node positions', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/');
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForSelector('.node-box', { timeout: 10000 });
  await pause(500);

  // Navigate into "Root" so we see Alpha/Beta/Gamma in the current column,
  // and Alpha's children on the right column with connector lines.
  await page.keyboard.press('ArrowRight');
  await pause(400);

  // Selected is Alpha at index 0; right-side SVG should have lines.
  // Capture the Y position of Alpha's box and the starting Y of the right-side lines.
  const measure = async () => {
    return page.evaluate(() => {
      const selected = document.querySelector('.node-list .node-box.selected, .node-list .node-box.editing');
      // Lines are <path> elements with d="M 0 startY C 30 startY, 30 endY, 60 endY"
      const svgs = Array.from(document.querySelectorAll('svg.lines-svg'));
      const data = svgs.map((svg) => {
        const paths = Array.from(svg.querySelectorAll('path'));
        const r = svg.getBoundingClientRect();
        const startYs = paths.map((p) => {
          const d = p.getAttribute('d') || '';
          // Extract first number after "M 0 "
          const m = d.match(/M\s+\S+\s+([\-\d.]+)/);
          return m ? parseFloat(m[1]) : NaN;
        }).filter((y) => !isNaN(y));
        return {
          svgTop: r.top,
          svgLeft: r.left,
          startYs,
          absStartYs: startYs.map((y) => r.top + y),
          pathCount: paths.length,
        };
      });
      const selRect = selected ? selected.getBoundingClientRect() : null;
      return {
        selectedCenterY: selRect ? selRect.top + selRect.height / 2 : null,
        svgs: data,
      };
    });
  };

  const before = await measure();
  expect(before.selectedCenterY).not.toBeNull();
  // Find the SVG whose lines start at the selected node center (right-side svg)
  const findRightSvg = (snap) => {
    return snap.svgs.find((s) =>
      s.absStartYs.some((y) => Math.abs(y - snap.selectedCenterY) < 5)
    );
  };
  const beforeRight = findRightSvg(before);
  expect(beforeRight, 'Right-side svg with lines starting at selected node should exist before swap').toBeDefined();

  // Press Shift+ArrowDown to swap Alpha down past Beta.
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');

  // Wait for swap animation (200ms) plus settling time
  await pause(800);

  const after = await measure();

  // The selected node (Alpha) should now be visually lower than before
  expect(after.selectedCenterY).toBeGreaterThan(before.selectedCenterY);

  // Find the right-side svg again (after swap there should still be lines from selected to children)
  const afterRight = findRightSvg(after);
  expect(
    afterRight,
    'After swap, right-side line startY must match new position of selected node (this is the bug being fixed)'
  ).toBeDefined();

  // Sanity: line start should track the new selected node center
  const newAbsStartY = afterRight.absStartYs[0];
  expect(Math.abs(newAbsStartY - after.selectedCenterY)).toBeLessThan(5);

  // And the line start position should have moved compared to before
  expect(after.selectedCenterY - before.selectedCenterY).toBeGreaterThan(10);

  // Press Shift+ArrowUp to swap back, also verifying the reverse direction.
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.up('Shift');
  await pause(800);

  const back = await measure();
  const backRight = findRightSvg(back);
  expect(backRight, 'After swapping back up, lines should still anchor to selected node').toBeDefined();
  expect(Math.abs(backRight.absStartYs[0] - back.selectedCenterY)).toBeLessThan(5);

  // Wait briefly so video captures final state
  await pause(500);
});
