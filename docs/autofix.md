# Autofix Pipeline — Area of Concern

## Design Philosophy
Label a GitHub issue with `autofix` and the daemon picks it up, spawns Claude Code in an isolated worktree, implements a fix with Playwright test proof, and opens a PR. Human reviews and merges. If Claude fails or times out, it retries up to 2 times before labeling `needs-human`.

## Module Structure
- `scripts/fix-issue.sh` — Core script. Fetches issue details, builds a prompt, spawns Claude in a worktree, then commits/pushes/creates a PR with video proof.
- `scripts/autofix-daemon.sh` — Polling loop. Runs continuously (10-minute interval), finds `autofix`-labeled issues not already in-progress, and calls `fix-issue.sh` on each. Recovers stale `in-progress` issues on startup and each cycle.
- `scripts/autofix-launchd.sh` — macOS launchd wrapper. Installs the daemon as a persistent service that survives terminal close, sleep, and reboot.

## How It Works

### Label lifecycle
1. User adds `autofix` label to an open issue.
2. Daemon picks it up → adds `in-progress`, removes from next poll.
3. On success → removes `in-progress`, adds `pr-pending`, creates PR with video proof.
4. On failure → increments `retry-N` label, removes `in-progress` (daemon retries next cycle).
5. After max retries (2) → removes `autofix`, adds `needs-human`.

### fix-issue.sh modes
- **Headless** (default): `./scripts/fix-issue.sh 42` — runs Claude non-interactively with 30-minute hard timeout and 10-minute idle detection.
- **Watch**: `./scripts/fix-issue.sh 42 --watch` — opens Claude in a tmux window for interactive observation.
- **PR**: `./scripts/fix-issue.sh 42 --pr` — commits and creates PR from an existing worktree (use after `--watch`).
- **Cleanup**: `./scripts/fix-issue.sh 42 --cleanup` — removes worktree and branch after PR is merged.

### Video proof
Playwright tests record `.webm` video. `fix-issue.sh` converts to `.gif` via ffmpeg, uploads as GitHub release assets (under a draft `video-proof` release), and posts them as a PR comment.

### .env handling
Worktrees branched before `.env` was tracked won't have it. The script copies `.env` from the main repo root into the worktree after Claude creates it. See memory note on this.

## Running the daemon

### Persistent (recommended) — survives terminal close, sleep, reboot:
```bash
./scripts/autofix-launchd.sh start    # install and start
./scripts/autofix-launchd.sh stop     # stop and uninstall
./scripts/autofix-launchd.sh status   # check if running
./scripts/autofix-launchd.sh logs     # tail the log
```

### Manual (for debugging):
```bash
# In tmux:
tmux new-window -n autofix './scripts/autofix-daemon.sh'

# Or directly:
./scripts/autofix-daemon.sh
```

Log file: `~/.treenote-autofix.log`

## Worktree Cleanup

### Automatic (in daemon loop)
Every poll cycle, the daemon checks `fix/issue-*` worktrees. If the corresponding PR is merged, it removes the worktree and branch automatically.

### Manual (interactive)
```bash
./scripts/autofix-launchd.sh cleanup
```
This auto-removes merged issue worktrees, then lists non-issue worktrees (agent-*, feat-*) and lets you pick which to remove interactively.

### What's safe to auto-clean
- `fix/issue-*` — created by the autofix pipeline, tied to a PR. Safe to remove once merged.

### What requires manual review
- `agent-*` — sub-agent worktrees from Claude Code sessions. May contain uncommitted work.
- `feat/*` — manual feature branches. May be in-progress.

## Rules for Modifying
- The prompt template in `fix-issue.sh` (lines ~222-279) tells Claude what to do. Update it if you add new conventions (e.g., new test patterns, new file locations).
- If you change the Playwright test mock pattern, update both the prompt template and the existing test files.
- The daemon polls every 10 minutes (`INTERVAL=600`). Claude gets 30 minutes (`CLAUDE_TIMEOUT=1800`) and 10 minutes idle detection (`STUCK_TIMEOUT=600`).
- Max retries is 2 (`MAX_RETRIES=2`). After that, issues get `needs-human`.
