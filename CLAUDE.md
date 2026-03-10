# Treenote — Claude Code Instructions

## Code Reuse Rules

Before creating a new component, hook, or utility:
1. Search the codebase for similar existing patterns (Grep/Glob for keywords).
2. If a similar component exists, generalize it rather than creating a new one.
3. If you need a modal with numbered options, use `OptionModal` from `src/components/OptionModal.jsx`.
4. If you need to mock Supabase auth in a Playwright test, follow the `setupMocks` pattern in existing tests (fake session in localStorage + route interception).

## Architecture

- All state lives in `App.jsx` — no state management library.
- Pure tree transformations go in `src/actions.js`.
- Keyboard handling goes in `src/hooks/useKeyboard.js`.
- Storage/API calls go in `src/storage.js`.
- New components get their own file in `src/components/`.

## Conventions

- Plain CSS, no frameworks. Component CSS lives alongside the component.
- No TypeScript — plain JSX.
- Supabase for auth and storage. Anon key is public; access token is secret.
- Data format is YAML (via js-yaml), with markdown auto-detection for backward compat.
- `version` column on `user_trees` enables optimistic concurrency control — always use versioned saves.

## Build & Test

- `npm run dev` — Vite dev server on port 5173
- `npm run build` — production build (must pass before committing)
- `npx playwright test` — run tests with video recording
- Tests mock Supabase auth via `page.route()` and `page.addInitScript()` — no real account needed.

## Autofix Pipeline

- `scripts/fix-issue.sh <N>` — fix a GitHub issue in a worktree
- `scripts/autofix-daemon.sh` — polls for `autofix`-labeled issues
- Labels: `autofix`, `in-progress`, `pr-pending`
- Video proof: Playwright records tests, ffmpeg converts to gif, uploaded as GitHub release assets
