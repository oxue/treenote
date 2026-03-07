#!/bin/bash
set -euo pipefail

# Polls for open issues labeled "autofix" every hour and runs fix-issue.sh on each.
# Usage: ./scripts/autofix-daemon.sh
# Run in tmux: tmux new-window -n autofix './scripts/autofix-daemon.sh'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL=600 # 10m

cd "$REPO_ROOT"

echo "Autofix daemon started. Polling every ${INTERVAL}s for issues labeled 'autofix'."

while true; do
  echo ""
  echo "=== $(date) — Checking for issues ==="

  # Get open issues labeled "autofix" that aren't already in-progress or pr-pending
  ISSUES=$(gh issue list \
    --repo oxue/treenote \
    --state open \
    --label autofix \
    --json number,title,labels \
    --jq '.[] | select(.labels | map(.name) | (contains(["in-progress"]) or contains(["pr-pending"])) | not) | .number' 2>/dev/null || true)

  if [ -z "$ISSUES" ]; then
    echo "No new issues to fix."
  else
    while IFS= read -r issue_num; do
      echo "--- Processing issue #${issue_num} ---"
      ./scripts/fix-issue.sh "$issue_num" || echo "Issue #${issue_num} failed, continuing..."
      echo "--- Done with issue #${issue_num} ---"
    done <<< "$ISSUES"
  fi

  echo "Sleeping ${INTERVAL}s until next poll..."
  sleep "$INTERVAL"
done
