# Visual Testing System for Treenote

A screenshot-based visual testing system that allows Claude Code to autonomously verify frontend changes by capturing and inspecting screenshots of the app.

## Design Decisions

### 1. Browser Automation Tool

| Option | Pros | Cons |
|--------|------|------|
| **Playwright** | Multi-browser, auto-wait, excellent screenshot API, built-in server management (`webServer` config), network interception for mocking | Larger install (~200MB for browsers) |
| Puppeteer | Lighter, Chrome-focused, mature | Chrome-only, no built-in server management, less convenient mocking |
| Cypress | Great interactive test runner | Heavy, designed for interactive testing not headless screenshots, slower startup |

**Decision: Playwright.** The built-in `webServer` config (auto-starts and stops vite preview), route interception (for mocking Supabase auth), and `page.screenshot()` API make it the clear winner for this use case. The install size is a non-issue for a dev dependency.

### 2. How to Serve the App

| Option | Pros | Cons |
|--------|------|------|
| `vite dev` | Hot reload, matches dev experience | Slower startup, unnecessary for screenshots |
| **`vite preview`** | Serves production build, fast, stable | Requires `npm run build` first |
| Hit deployed Vercel URL | No local server needed | Requires internet, can't test local changes, slow |

**Decision: `vite preview`.** Screenshots should verify the production build (what users actually see). Playwright's `webServer` config handles building and starting the preview server automatically.

### 3. How to Handle Auth-Gated Pages

| Option | Pros | Cons |
|--------|------|------|
| Use real Supabase test account | Truly end-to-end | Requires credentials in env, flaky if network issues, slow OAuth flow |
| Mock Supabase at the network level | No credentials needed, fast, deterministic | Requires knowing the Supabase API shape |
| **Bypass AuthGate via localStorage injection** | Simple, no network mocking needed, fast | Slightly less realistic |
| Add a `?test=true` query param bypass | Very simple | Modifies app code (not allowed) |

**Decision: Mock Supabase at the network level using Playwright's `page.route()`.** This intercepts the Supabase auth API calls and returns fake session data, so the app behaves exactly as it would with a real login — AuthGate sees a valid session, App.jsx gets a userId, and the tree loads from a mocked response. No app code changes needed, fully deterministic, and tests the real auth flow.

### 4. How to Get the App Into Interesting Visual States

| Option | Pros | Cons |
|--------|------|------|
| **Mock Supabase REST responses with fixture data** | Deterministic, no database needed, fast | Need to maintain fixture data |
| Seed a real test database | Most realistic | Requires credentials, slow, could conflict with real data |
| Interact via Playwright (click, type) | Tests real interactions | Slow, brittle, hard to set up complex states |

**Decision: Mock Supabase REST responses.** The screenshot script intercepts `fetch` calls to Supabase and returns fixture JSON data (a sample tree, empty queue, etc.). This means screenshots are 100% deterministic — same data every time, no external dependencies.

### 5. Screenshot Comparison Strategy

| Option | Pros | Cons |
|--------|------|------|
| **Claude visual inspection (Read tool)** | Understands context, can judge layout/design quality, flexible | Subjective, costs tokens |
| Pixel-diff against baselines | Objective, catches subtle regressions | Brittle (font rendering, antialiasing), false positives, needs baseline management |
| Both | Best coverage | Complex setup |

**Decision: Claude visual inspection only.** The primary use case is Claude autonomously verifying its own changes during ralph-loop iterations. Claude can `Read` a PNG screenshot and judge whether the UI looks correct. Pixel-diff is overkill for this workflow and creates maintenance burden with baseline images. If pixel-diff is needed later, Playwright has built-in `expect(page).toHaveScreenshot()` that can be added.

### 6. Screenshot Storage and Naming

**Location:** `screenshots/` directory at project root (gitignored — these are ephemeral verification artifacts, not committed).

**Naming convention:** `{state-name}.png` — simple, descriptive names:
- `login-page.png` — the auth gate / login screen
- `main-tree.png` — main tree view with data loaded
- `tree-with-children.png` — drilled into a node showing children column
- `queue-bar.png` — tree view with items in the queue bar
- `empty-state.png` — app with no tree data

### 7. Integration with Claude Code Workflow

The system provides two things:

1. **`npm run screenshot`** — captures all predefined screenshots in one command
2. **`npm run screenshot:login`** etc. — capture individual states (via argument)

During a ralph-loop iteration, Claude should:
1. Make code changes
2. Run `npm run screenshot` via Bash
3. `Read` the screenshot PNGs to visually verify the changes look correct
4. If something looks wrong, fix and re-screenshot

## Usage

### For Claude Code (in prompts/ralph-loops)

Add to any ralph-loop prompt that involves UI changes:
```
After making changes, run 'npm run screenshot' and use the Read tool to inspect screenshots/main-tree.png (and other relevant screenshots) to verify the UI looks correct.
```

Example full ralph-loop prompt:
```
/ralph-loop "Change the node box border radius from 8px to 12px. After making the change, run 'npm run screenshot' and Read the screenshots to verify the change looks good visually. Output <promise>COMPLETE</promise> when done." --completion-promise "COMPLETE" --max-iterations 10
```

### For oppyolly (the human engineer)

- **Take screenshots:** `npm run screenshot` — captures all states, saves to `screenshots/`
- **View them:** Open the PNGs in any image viewer, or let Claude inspect them
- **When to use:** Before/after any UI change to compare visually
- **In issues:** Attach screenshots to GitHub issues for visual context
- **Custom screenshots:** The script at `scripts/take-screenshots.mjs` can be extended with new states

### Adding New Screenshot States

Edit `scripts/screenshot-states.mjs` to add new states. Each state is an object with:
- `name` — filename (without .png)
- `setup(page)` — async function to set up the page state (navigate, mock data, interact)

## Architecture

```
scripts/
  take-screenshots.mjs    — Main script: starts server, captures all screenshots
  screenshot-states.mjs   — Defines visual states and their setup functions
  fixtures/
    sample-tree.json      — Sample tree data for mocking
screenshots/              — Output directory (gitignored)
  login-page.png
  main-tree.png
  ...
```
