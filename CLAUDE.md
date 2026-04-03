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

## Context Architecture (Layered Indirection)

CLAUDE.md contains **policies and pointers**, not implementation details. For any area of concern, follow this 3-level chain:

1. **CLAUDE.md** — rules, conventions, pointers to area docs.
2. **Area docs** (`docs/`) — design philosophy, module relationships, key routing. Read these before touching the area.
3. **Source files** — the actual implementation. Area docs tell you which files to read.

This keeps CLAUDE.md small (it's always in context) while giving Claude enough breadcrumbs to find what it needs.

### Area docs
- `docs/keybindings.md` — keyboard handling: design philosophy, module structure, key reference, rules for modifying.
- `docs/autofix.md` — autofix pipeline: daemon, fix-issue script, label lifecycle, video proof, retry logic.
- `docs/mobile-app.md` — mobile app: module structure, state ownership, Capacitor/iOS integration, widget sync, modification rules.
- `docs/mobile-design.md` — mobile app design spec: screen architecture, gestures, interaction patterns, implementation plan.
- `docs/exploration.md` — exploration mode: diverge-then-converge workflow for research chats, phase signals, rules of engagement.

### Maintenance rules
1. **Before touching an area**: read its area doc if one exists.
2. **After modifying an area**: update the area doc to reflect what changed (new keys, new state, new modules).
3. **When creating a new area** (new hook, new major subsystem): create a `docs/<area>.md` with design philosophy, module structure, and modification rules. Add a pointer here.
4. An "area" is any cluster of 2+ files that share non-obvious design constraints (e.g., keybindings span useKeyboard.js + App.jsx + useEjectAnimation.js).

## Conventions

- Plain CSS, no frameworks. Component CSS lives alongside the component.
- No TypeScript — plain JSX.
- Supabase for auth and storage. Anon key is public; access token is secret.
- Data format is YAML (via js-yaml), with markdown auto-detection for backward compat.
- `version` column on `user_trees` enables optimistic concurrency control — always use versioned saves.

## Build & Test

- `npm run dev` — Vite dev server. **Must run on port 5173** (Supabase OAuth redirect is configured for this port). Kill any existing server on 5173 before starting.
- `npm run build` — production build (must pass before committing)
- `npx playwright test` — run tests with video recording
- Tests mock Supabase auth via `page.route()` and `page.addInitScript()` — no real account needed.

## Autofix Pipeline

- `scripts/fix-issue.sh <N>` — fix a GitHub issue in a worktree
- `scripts/autofix-daemon.sh` — polls for `autofix`-labeled issues
- `scripts/autofix-launchd.sh start|stop|status|logs` — run daemon as persistent macOS service
- Labels: `autofix`, `in-progress`, `pr-pending`, `needs-human`
- Video proof: Playwright records tests, ffmpeg converts to gif, uploaded as GitHub release assets
