#!/bin/bash
set -euo pipefail

# Usage: ./scripts/fix-issue.sh <issue-number> [--watch|--pr|--cleanup]
# Picks up a GitHub issue, spawns Claude in a worktree to fix it, and creates a PR.
# --watch:   opens Claude in a new tmux window so you can watch it work
# --pr:      commits, pushes, and creates PR from an existing worktree (use after --watch)
# --cleanup: removes worktree and branch if the PR has been merged

ISSUE_NUM="${1:?Usage: fix-issue.sh <issue-number> [--watch|--pr|--cleanup]}"
MODE="${2:-headless}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="fix/issue-${ISSUE_NUM}"
LOG_FILE="${HOME}/.treenote-autofix.log"

# Max time to wait for Claude to finish (30 minutes)
CLAUDE_TIMEOUT=1800
# If no activity in conversation log for this many seconds, consider stuck
STUCK_TIMEOUT=600

cd "$REPO_ROOT"

# Logging helper — writes to stdout and to log file
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [issue-${ISSUE_NUM}] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

# Fetch issue details
log "Fetching issue #${ISSUE_NUM}..."
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --json title,body,labels)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')

log "Issue: $ISSUE_TITLE"

# Check retry count label (e.g. "retry-1", "retry-2")
RETRY_COUNT=$(echo "$ISSUE_JSON" | jq -r '.labels[].name' | grep -E '^retry-[0-9]+$' | sort -t- -k2 -n | tail -1 | grep -oE '[0-9]+$' || echo "0")
MAX_RETRIES=2

# --- Shared: upload video proof as inline gifs on a PR ---
upload_video_proof() {
  local pr_number="$1"
  local worktree_path="$2"

  VIDEO_FILES=$(find "$worktree_path" -path '*/test-results/*' -name '*.webm' 2>/dev/null || true)
  if [ -z "$VIDEO_FILES" ]; then
    log "No video recordings found."
    return
  fi

  log "Converting videos to gifs and uploading..."
  TOKEN=$(gh auth token)

  # Get or create a draft release for video assets
  RELEASE_ID=$(curl -s \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/oxue/treenote/releases/tags/video-proof" 2>/dev/null | jq -r '.id // empty')

  if [ -z "$RELEASE_ID" ]; then
    RELEASE_ID=$(curl -s -X POST \
      -H "Authorization: token $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -d '{"tag_name":"video-proof","name":"Video Proof Assets","draft":true}' \
      "https://api.github.com/repos/oxue/treenote/releases" | jq -r '.id')
  fi

  UPLOAD_URL="https://uploads.github.com/repos/oxue/treenote/releases/${RELEASE_ID}/assets"
  COMMENT_BODY="## Video Proof"$'\n\n'
  INDEX=0

  while IFS= read -r webm_file; do
    INDEX=$((INDEX + 1))
    GIF_NAME="issue-${ISSUE_NUM}-${INDEX}.gif"
    GIF_PATH="/tmp/${GIF_NAME}"

    # Convert webm to gif
    ffmpeg -y -i "$webm_file" \
      -vf "fps=10,scale=700:-1:flags=lanczos" -loop 0 \
      "$GIF_PATH" 2>/dev/null

    # Delete existing asset with same name if it exists
    EXISTING_ASSET_ID=$(curl -s \
      -H "Authorization: token $TOKEN" \
      "https://api.github.com/repos/oxue/treenote/releases/${RELEASE_ID}/assets" | \
      jq -r ".[] | select(.name==\"${GIF_NAME}\") | .id // empty")
    if [ -n "$EXISTING_ASSET_ID" ]; then
      curl -s -X DELETE \
        -H "Authorization: token $TOKEN" \
        "https://api.github.com/repos/oxue/treenote/releases/assets/${EXISTING_ASSET_ID}" > /dev/null
    fi

    # Upload gif
    DL_URL=$(curl -s -X POST \
      "${UPLOAD_URL}?name=${GIF_NAME}" \
      -H "Authorization: token $TOKEN" \
      -H "Content-Type: image/gif" \
      --data-binary "@${GIF_PATH}" | jq -r '.browser_download_url')

    # Extract test name from path
    TEST_DIR=$(dirname "$webm_file")
    TEST_NAME=$(basename "$TEST_DIR" | sed "s/^issue-${ISSUE_NUM}-//" | tr '-' ' ')

    COMMENT_BODY+="### ${TEST_NAME}"$'\n'
    COMMENT_BODY+="![${GIF_NAME}](${DL_URL})"$'\n\n'

    rm -f "$GIF_PATH"
  done <<< "$VIDEO_FILES"

  COMMENT_BODY+="_Recorded by Playwright during automated testing._"

  gh pr comment "$pr_number" --body "$COMMENT_BODY" --repo "oxue/treenote"
  log "Video proof posted on PR #${pr_number}."
}

# --- Shared: commit, push, create PR, upload videos ---
create_pr() {
  local worktree_path="$1"
  cd "$worktree_path"

  # Commit uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "fix: resolve issue #${ISSUE_NUM} — ${ISSUE_TITLE}"
  fi

  # Check for commits
  COMMITS_AHEAD=$(git rev-list --count master..HEAD 2>/dev/null || echo "0")
  if [ "$COMMITS_AHEAD" -eq 0 ]; then
    log "No commits to push."
    gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but produced no changes. Manual review needed." --repo "oxue/treenote" 2>/dev/null || true
    gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" 2>/dev/null || true
    exit 1
  fi

  # Push
  log "Pushing branch..."
  git push -u origin "worktree-${BRANCH}" 2>/dev/null || git push -u origin HEAD

  # Check if PR already exists
  EXISTING_PR=$(gh pr list --head "worktree-${BRANCH}" --json url --jq '.[0].url' --repo "oxue/treenote" 2>/dev/null || true)
  if [ -n "$EXISTING_PR" ]; then
    log "PR already exists: $EXISTING_PR (pushed latest changes)"
    PR_URL="$EXISTING_PR"
  else
    PR_URL=$(gh pr create \
      --title "fix: ${ISSUE_TITLE}" \
      --body "Closes #${ISSUE_NUM}

Auto-generated fix by Claude Code agent.

## Issue
${ISSUE_BODY}" \
      --base master \
      --repo "oxue/treenote")
    log "PR created: $PR_URL"
  fi

  PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]*$')

  # Upload video proof
  upload_video_proof "$PR_NUMBER" "$worktree_path"

  # Update labels
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --add-label "pr-pending" --repo "oxue/treenote" 2>/dev/null || true

  log "Done! Issue #${ISSUE_NUM} → ${PR_URL}"
  log "Worktree at: ${worktree_path}"
}

# --cleanup mode: remove worktree if PR is merged
if [ "$MODE" = "--cleanup" ]; then
  WORKTREE_PATH=".claude/worktrees/${BRANCH}"
  if [ ! -d "$WORKTREE_PATH" ]; then
    log "No worktree found at ${WORKTREE_PATH}"
    exit 0
  fi
  PR_STATE=$(gh pr list --head "worktree-${BRANCH}" --state merged --json state --jq '.[0].state' --repo "oxue/treenote" 2>/dev/null || true)
  if [ "$PR_STATE" = "MERGED" ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -D "worktree-${BRANCH}" 2>/dev/null || true
    log "Cleaned up worktree and branch for issue #${ISSUE_NUM}."
  else
    log "PR not merged yet — keeping worktree."
  fi
  exit 0
fi

# --pr mode: commit/push/PR from existing worktree
if [ "$MODE" = "--pr" ]; then
  WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"
  if [ ! -d "$WORKTREE_PATH" ]; then
    log "No worktree found at ${WORKTREE_PATH}"
    exit 1
  fi
  create_pr "$WORKTREE_PATH"
  exit 0
fi

# --- Headless mode ---

# Check if this issue has exceeded max retries
if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
  log "Issue #${ISSUE_NUM} has already been retried ${RETRY_COUNT} times (max ${MAX_RETRIES}). Marking as needs-human."
  gh issue comment "$ISSUE_NUM" \
    --body "Autofix agent failed after ${RETRY_COUNT} attempts. Marking for human review." \
    --repo "oxue/treenote" 2>/dev/null || true
  gh issue edit "$ISSUE_NUM" \
    --remove-label "in-progress" \
    --remove-label "autofix" \
    --add-label "needs-human" \
    --repo "oxue/treenote" 2>/dev/null || true
  exit 1
fi

# Label as in-progress
gh issue edit "$ISSUE_NUM" --add-label "in-progress" --repo "oxue/treenote" 2>/dev/null || true

# Build the prompt
PROMPT="You are fixing a bug in the treenote project.

## GitHub Issue #${ISSUE_NUM}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Instructions
1. Read the relevant code to understand the problem.
2. Implement a fix.
3. Run \`npm run build\` to verify the build passes.
4. Keep changes minimal and focused on the issue.
5. Do not modify unrelated code.

## Video Proof
After implementing the fix, you MUST create a Playwright test that demonstrates it working.

Create the test at \`tests/issue-${ISSUE_NUM}.spec.js\` using this pattern:

\`\`\`js
import { test, expect } from '@playwright/test';

test('issue ${ISSUE_NUM}: <describe what you are testing>', async ({ page }) => {
  // The app is a tree-based note-taking app
  // It requires Supabase auth, but for testing you can check the UI elements
  // Navigate to the app
  await page.goto('http://localhost:5173');

  // Wait for the app to load
  await page.waitForSelector('.app');

  // Demonstrate the fix with user interactions
  // ... your test steps here ...
});
\`\`\`

Configure video recording by creating \`playwright.config.js\` (if it doesn't exist) with:

\`\`\`js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5173',
    video: 'on',
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
\`\`\`

After creating the test, run it with: \`npx playwright test tests/issue-${ISSUE_NUM}.spec.js\`

Make sure the test passes. The video will be saved in \`test-results/\`."

# Copy .env to worktree after Claude creates it
copy_env() {
  local wt="$REPO_ROOT/.claude/worktrees/${BRANCH}"
  if [ -d "$wt" ] && [ -f "$REPO_ROOT/.env" ] && [ ! -f "$wt/.env" ]; then
    cp "$REPO_ROOT/.env" "$wt/.env"
  fi
}

# Bump retry counter label before running (so we track attempts even if we get killed)
NEXT_RETRY=$((RETRY_COUNT + 1))
# Remove old retry label if present, add new one
if [ "$RETRY_COUNT" -gt 0 ]; then
  gh issue edit "$ISSUE_NUM" --remove-label "retry-${RETRY_COUNT}" --repo "oxue/treenote" 2>/dev/null || true
fi
if [ "$NEXT_RETRY" -le "$MAX_RETRIES" ]; then
  gh issue edit "$ISSUE_NUM" --add-label "retry-${NEXT_RETRY}" --repo "oxue/treenote" 2>/dev/null || true
fi

# Run Claude in a worktree
log "Spawning Claude in worktree '${BRANCH}' (attempt $((RETRY_COUNT + 1)) of $((MAX_RETRIES + 1)))..."
if [ "$MODE" = "--watch" ]; then
  # Interactive: open Claude with full UI in a new tmux window
  PROMPT_FILE=$(mktemp)
  printf '%s' "$PROMPT" > "$PROMPT_FILE"
  # Copy .env after a short delay to let worktree be created
  (sleep 5 && cp "$REPO_ROOT/.env" "$REPO_ROOT/.claude/worktrees/${BRANCH}/.env" 2>/dev/null || true) &
  tmux new-window -n "fix-#${ISSUE_NUM}" \
    "cd '$REPO_ROOT' && claude --worktree '$BRANCH' --dangerously-skip-permissions \"\$(cat '$PROMPT_FILE')\"; rm -f '$PROMPT_FILE'"
  log "Opened in tmux window 'fix-#${ISSUE_NUM}'."
  log "When it's done, create the PR with: ./scripts/fix-issue.sh ${ISSUE_NUM} --pr"
  exit 0
else
  # Headless mode: run with timeout + stuck-detection
  CONVERSATION_LOG=$(mktemp /tmp/claude-issue-${ISSUE_NUM}-XXXXXX.log)
  CLAUDE_PID=""
  TIMED_OUT=false

  # Launch Claude in background, redirect output to log file
  claude -p "$PROMPT" \
    --worktree "$BRANCH" \
    --dangerously-skip-permissions \
    --max-turns 50 \
    --output-format json > "$CONVERSATION_LOG" 2>&1 &
  CLAUDE_PID=$!
  log "Claude started with PID ${CLAUDE_PID}, log: ${CONVERSATION_LOG}"

  # Monitor Claude: enforce hard timeout and stuck detection
  ELAPSED=0
  CHECK_INTERVAL=30
  while kill -0 "$CLAUDE_PID" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))

    # Hard timeout
    if [ "$ELAPSED" -ge "$CLAUDE_TIMEOUT" ]; then
      log "Claude PID ${CLAUDE_PID} exceeded hard timeout (${CLAUDE_TIMEOUT}s). Killing."
      kill "$CLAUDE_PID" 2>/dev/null || true
      sleep 2
      kill -9 "$CLAUDE_PID" 2>/dev/null || true
      TIMED_OUT=true
      break
    fi

    # Stuck detection: check if log file hasn't grown in STUCK_TIMEOUT seconds
    if [ -f "$CONVERSATION_LOG" ]; then
      LAST_MODIFIED=$(date -r "$CONVERSATION_LOG" +%s 2>/dev/null || echo "0")
      NOW=$(date +%s)
      IDLE=$((NOW - LAST_MODIFIED))
      if [ "$IDLE" -ge "$STUCK_TIMEOUT" ]; then
        log "Claude PID ${CLAUDE_PID} has been idle for ${IDLE}s (no log activity). Treating as stuck."
        kill "$CLAUDE_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$CLAUDE_PID" 2>/dev/null || true
        TIMED_OUT=true
        break
      fi
    fi
  done

  # Wait for Claude to fully exit and capture exit code
  wait "$CLAUDE_PID" 2>/dev/null || true

  if [ "$TIMED_OUT" = true ]; then
    log "Claude timed out for issue #${ISSUE_NUM}."
    gh issue comment "$ISSUE_NUM" \
      --body "Autofix agent timed out (${CLAUDE_TIMEOUT}s limit). Will retry automatically (attempt $((RETRY_COUNT + 1)) of $((MAX_RETRIES + 1)))." \
      --repo "oxue/treenote" 2>/dev/null || true
    gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" 2>/dev/null || true
    rm -f "$CONVERSATION_LOG"
    exit 1
  fi

  rm -f "$CONVERSATION_LOG"
  copy_env
fi

# Headless mode: auto-create PR
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"
if [ ! -d "$WORKTREE_PATH" ]; then
  log "No worktree created — Claude may not have made changes."
  gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but did not produce changes. Manual review needed." --repo "oxue/treenote" 2>/dev/null || true
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" 2>/dev/null || true
  exit 1
fi

create_pr "$WORKTREE_PATH"
