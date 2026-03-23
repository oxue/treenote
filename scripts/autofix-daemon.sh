#!/bin/bash
set -euo pipefail

# Polls for open issues labeled "autofix" every hour and runs fix-issue.sh on each.
# Usage: ./scripts/autofix-daemon.sh
# Run in tmux: tmux new-window -n autofix './scripts/autofix-daemon.sh'

# Always resolve to the MAIN repo root, even if invoked from a worktree.
REPO_ROOT="$(cd "$(dirname "$0")/.." && git worktree list --porcelain | head -1 | sed 's/^worktree //')"
INTERVAL=30 # 30s
LOG_FILE="${HOME}/.treenote-autofix.log"

cd "$REPO_ROOT"

# Logging helper
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [daemon] $*"
  # Write to log file only. Stdout also goes to log file via launchd,
  # so echoing to both would double every line.
  echo "$msg" >> "$LOG_FILE"
}

log "Autofix daemon started. Polling every ${INTERVAL}s for issues labeled 'autofix'."

# --- Recovery: handle issues left in-progress with no running Claude ---
recover_stale_inprogress() {
  log "Checking for stale in-progress issues..."

  INPROGRESS=$(gh issue list \
    --repo oxue/treenote \
    --state open \
    --label in-progress \
    --json number,title,labels \
    --jq '.[].number' 2>/dev/null || true)

  if [ -z "$INPROGRESS" ]; then
    return
  fi

  while IFS= read -r issue_num; do
    BRANCH="fix-issue-${issue_num}"
    WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"

    # Check if a Claude process is actively handling this issue
    CLAUDE_RUNNING=$(pgrep -f "fix-issue-${issue_num}" 2>/dev/null | head -1 || true)
    if [ -n "$CLAUDE_RUNNING" ]; then
      log "Issue #${issue_num}: Claude is still running (PID ${CLAUDE_RUNNING}), skipping recovery."
      continue
    fi

    log "Issue #${issue_num}: marked in-progress but no Claude process found — recovering."

    # If worktree exists with commits, try to create a PR from the existing work
    if [ -d "$WORKTREE_PATH" ]; then
      COMMITS_AHEAD=$(cd "$WORKTREE_PATH" && git rev-list --count master..HEAD 2>/dev/null || echo "0")
      if [ "$COMMITS_AHEAD" -gt 0 ]; then
        log "Issue #${issue_num}: worktree has ${COMMITS_AHEAD} commit(s) — attempting to create PR."
        "$REPO_ROOT/scripts/fix-issue.sh" "$issue_num" --pr 2>&1 | tee -a "$LOG_FILE" || {
          log "Issue #${issue_num}: PR creation failed. Removing in-progress label for retry."
          gh issue edit "$issue_num" --remove-label "in-progress" --repo oxue/treenote 2>/dev/null || true
        }
      else
        log "Issue #${issue_num}: worktree exists but no commits. Removing in-progress label for retry."
        gh issue edit "$issue_num" --remove-label "in-progress" --repo oxue/treenote 2>/dev/null || true
      fi
    else
      log "Issue #${issue_num}: no worktree found. Removing in-progress label for retry."
      gh issue edit "$issue_num" --remove-label "in-progress" --repo oxue/treenote 2>/dev/null || true
    fi
  done <<< "$INPROGRESS"
}

# --- Cleanup: remove worktrees for merged issue PRs ---
cleanup_merged_worktrees() {
  log "Checking for merged worktrees to clean up..."

  # Only auto-clean fix-issue-* worktrees (autofix pipeline).
  # agent-* and feat-* worktrees are manual — skip them.
  for wt_path in "$REPO_ROOT"/.claude/worktrees/fix-issue-*; do
    [ -d "$wt_path" ] || continue

    issue_num=$(basename "$wt_path" | sed 's/issue-//')
    BRANCH="fix-issue-${issue_num}"

    # Check if the PR branch has been merged
    PR_STATE=$(gh pr list --head "worktree-${BRANCH}" --state merged --json state --jq '.[0].state' --repo "oxue/treenote" 2>/dev/null || true)
    if [ "$PR_STATE" = "MERGED" ]; then
      log "Cleanup: issue #${issue_num} PR is merged — removing worktree and branch."
      git worktree remove "$wt_path" --force 2>/dev/null || {
        log "Cleanup: failed to remove worktree at ${wt_path}, trying rm."
        rm -rf "$wt_path"
        git worktree prune 2>/dev/null || true
      }
      git branch -D "worktree-${BRANCH}" 2>/dev/null || true
    fi
  done

  # Prune any stale worktree references
  git worktree prune 2>/dev/null || true
}

# Run recovery and cleanup once at startup
recover_stale_inprogress
cleanup_merged_worktrees

while true; do
  log ""
  log "=== Checking for issues ==="

  # Get open issues labeled "autofix" that aren't already in-progress, pr-pending, or needs-human
  ISSUES=$(gh issue list \
    --repo oxue/treenote \
    --state open \
    --label autofix \
    --json number,title,labels \
    --jq '.[] | select(.labels | map(.name) | (contains(["in-progress"]) or contains(["pr-pending"]) or contains(["needs-human"])) | not) | .number' 2>/dev/null || true)

  if [ -z "$ISSUES" ]; then
    log "No new issues to fix."
  else
    while IFS= read -r issue_num; do
      log "--- Processing issue #${issue_num} ---"
      "$REPO_ROOT/scripts/fix-issue.sh" "$issue_num" 2>&1 | tee -a "$LOG_FILE" || log "Issue #${issue_num} failed, continuing..."
      log "--- Done with issue #${issue_num} ---"
    done <<< "$ISSUES"
  fi

  # Check for PRs needing revision (labeled "revise")
  REVISIONS=$(gh pr list \
    --repo oxue/treenote \
    --state open \
    --label revise \
    --json number,headRefName,labels \
    --jq '.[] | select(.labels | map(.name) | contains(["in-progress"]) | not) | "\(.number)|\(.headRefName)"' 2>/dev/null || true)

  if [ -z "$REVISIONS" ]; then
    log "No revisions to process."
  else
    while IFS= read -r revision_info; do
      pr_num=$(echo "$revision_info" | cut -d'|' -f1)
      log "--- Revising PR #${pr_num} ---"
      "$REPO_ROOT/scripts/fix-issue.sh" "$pr_num" --revise 2>&1 | tee -a "$LOG_FILE" || log "Revision PR #${pr_num} failed, continuing..."
      log "--- Done revising PR #${pr_num} ---"
    done <<< "$REVISIONS"
  fi

  log "Sleeping ${INTERVAL}s until next poll..."
  sleep "$INTERVAL"

  # Run recovery and cleanup each cycle
  recover_stale_inprogress
  cleanup_merged_worktrees
done
