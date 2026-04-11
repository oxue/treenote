# Autofix Integration — Area of Concern

## Overview

Treenote uses the **standalone autofix daemon** at `~/src/autofix-daemon` ([github.com/oxue/autofix-daemon](https://github.com/oxue/autofix-daemon)). The daemon is NOT part of this repo — it's a separate project that serves multiple repos.

For daemon internals (architecture, config format, modes, security), see the daemon repo's `CLAUDE.md`.

## Treenote-Specific Files

- **`.autofix-prompt.md`** — Treenote's prompt template. This is what Claude sees when fixing an issue. If you change conventions (test patterns, file locations, build commands), update this file.
- **`~/src/autofix-daemon/projects/treenote.conf`** — Daemon config for treenote. Contains repo path, allowed authors, deploy command, timeout settings.

## How to Use

### Fix an issue automatically
Add the `autofix` label to a GitHub issue. The daemon picks it up within 30 seconds.

### Request a revision on a PR
Leave comments on the PR, then add the `revise` label to the PR.

### Labels
- `autofix` — trigger autofix on an issue
- `revise` — trigger revision on a PR
- `in-progress` — daemon is working on it
- `pr-pending` — PR created, awaiting review
- `needs-human` — agent failed after max retries

### Daemon management
```bash
~/src/autofix-daemon/launchd.sh start|stop|status|logs|cleanup
```

### Log file
`~/.autofix.log` (all projects share one log, prefixed with `[treenote]`)

## Rules for Modifying

- **Prompt template**: Edit `.autofix-prompt.md` in this repo root. Available variables: `${PROJECT_NAME}`, `${ISSUE_NUM}`, `${ISSUE_TITLE}`, `${ISSUE_BODY}`.
- **Video proof must visually demonstrate the fix.** Tests must inject tree data containing the specific content that triggers the bug. Returning `[]` for `user_trees` loads the default tree — which won't contain the right content. Use the `capture-media.spec.js` pattern: return `{ tree_data: customTree, version: 1 }` from the mock route.
- Branch names use `fix-issue-N` (flat, no slashes). Claude's `--worktree` flag breaks with slashes.
- `--output-format json` writes nothing until Claude finishes. Don't add idle detection based on log file modification.
