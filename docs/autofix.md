# Autofix Pipeline — Area of Concern

## Design Philosophy
Label a GitHub issue with `autofix` and the daemon picks it up, spawns Claude Code in an isolated worktree, implements a fix with Playwright test proof, and opens a PR. Human reviews and merges — or leaves feedback and adds `revise` to the PR for another iteration. When a PR merges, the daemon auto-deploys to prod.

## Module Structure
- `scripts/fix-issue.sh` — Core script. Fetches issue details, builds a prompt, spawns Claude in a worktree, then commits/pushes/creates a PR with video proof. Also handles revisions.
- `scripts/autofix-daemon.sh` — Polling loop. Runs every 30 seconds, finds `autofix`-labeled issues and `revise`-labeled PRs, handles recovery/cleanup, and auto-deploys on new master commits.
- `scripts/autofix-launchd.sh` — macOS launchd wrapper. Installs the daemon as a persistent service that survives terminal close, sleep, and reboot.
- `~/Library/Application Support/SwiftBar/plugins/autofix.30s.sh` — Menu bar status icon (display only, outside repo). Shows green/red bolt, start/stop controls, recent log lines.

## How It Works

### Label lifecycle
1. User adds `autofix` label to an open issue.
2. Daemon picks it up → adds `in-progress`, bumps `retry-N` label.
3. On success → removes `in-progress`, adds `pr-pending`, creates PR with video proof.
4. On failure → removes `in-progress` (daemon retries next cycle with incremented retry label).
5. After max retries (2) → removes `autofix`, adds `needs-human`.

### Revision flow
1. User reviews the PR, leaves comments (conversation, inline code review, or review summary).
2. User adds `revise` label to the PR.
3. Daemon picks it up → runs Claude in the **existing worktree** with the PR feedback.
4. Claude applies changes on top, commits, pushes (updates the PR).
5. `revise` label is removed. User can repeat the cycle.

### fix-issue.sh modes
- **Headless** (default): `./scripts/fix-issue.sh 42` — runs Claude non-interactively with 30-minute hard timeout.
- **Watch**: `./scripts/fix-issue.sh 42 --watch` — opens Claude in a tmux window for interactive observation.
- **PR**: `./scripts/fix-issue.sh 42 --pr` — commits and creates PR from an existing worktree (use after `--watch`).
- **Cleanup**: `./scripts/fix-issue.sh 42 --cleanup` — removes worktree and branch after PR is merged.
- **Revise**: `./scripts/fix-issue.sh 42 --revise` — takes a PR number, fetches reviewer feedback, runs Claude in existing worktree to apply changes.

### Video proof
Playwright tests record `.webm` video. `fix-issue.sh` converts to `.gif` via ffmpeg, uploads as GitHub release assets (under a draft `video-proof` release), and posts them as a PR comment.

### Auto-deploy
Every poll cycle, the daemon pulls master and compares HEAD to the last deployed commit (stored in `~/.treenote-last-deploy`). If different, it runs `vercel --prod`. This means any merged PR triggers a deploy within 30 seconds.

### .env handling
Worktrees branched before `.env` was tracked won't have it. The script copies `.env` from the main repo root into the worktree after Claude creates it.

## Security

### Author whitelist
`fix-issue.sh` has an `ALLOWED_AUTHORS` variable (currently `oxue`). Before processing any issue, it checks the issue author is in the whitelist. If not, it strips labels and exits. This prevents prompt injection from untrusted issue authors on the public repo.

### Comment filtering
In `--revise` mode, only PR comments from `ALLOWED_AUTHORS` are fed to Claude. Comments from strangers are ignored.

### Label gating
Only repo collaborators can add labels (`autofix`, `revise`), so the labels themselves are the human-in-the-loop gate.

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
Every poll cycle, the daemon checks `fix-issue-*` worktrees. If the corresponding PR is merged, it removes the worktree and branch automatically.

### Manual (interactive)
```bash
./scripts/autofix-launchd.sh cleanup
```
This auto-removes merged issue worktrees, then lists non-issue worktrees (agent-*, feat-*) and lets you pick which to remove interactively.

### What's safe to auto-clean
- `fix-issue-*` — created by the autofix pipeline, tied to a PR. Safe to remove once merged.

### What requires manual review
- `agent-*` — sub-agent worktrees from Claude Code sessions. May contain uncommitted work.
- `feat/*` — manual feature branches. May be in-progress.

## Rules for Modifying
- The prompt template in `fix-issue.sh` tells Claude what to do. Update it if you add new conventions (e.g., new test patterns, new file locations).
- If you change the Playwright test mock pattern, update both the prompt template and the existing test files.
- **Video proof must visually demonstrate the fix.** Tests must inject tree data containing the specific content that triggers the bug (e.g., markdown-formatted nodes to prove breadcrumbs strip formatting). Returning `[]` for `user_trees` loads the default tree — which won't contain the right content. Use the `capture-media.spec.js` pattern: return `{ tree_data: customTree, version: 1 }` from the mock route.
- The daemon polls every 30 seconds (`INTERVAL=30`). Claude gets 30 minutes (`CLAUDE_TIMEOUT=1800`).
- Max retries is 2 (`MAX_RETRIES=2`). After that, issues get `needs-human`.
- Branch names use `fix-issue-N` (flat, no slashes). Claude's `--worktree` flag breaks with slashes in branch names.
- `--output-format json` writes nothing until Claude finishes. Don't add idle detection based on log file modification — it will false-positive.
- When capturing command output into a variable with `$()`, use `2>/dev/null` not `>/dev/null 2>&1` — the latter silences stdout which is what you're trying to capture.
