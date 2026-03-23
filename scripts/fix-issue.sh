#!/bin/bash
set -euo pipefail

# Usage: ./scripts/fix-issue.sh <issue-number> [--watch|--pr|--cleanup|--revise]
# Picks up a GitHub issue, spawns Claude in a worktree to fix it, and creates a PR.
# --watch:   opens Claude in a new tmux window so you can watch it work
# --pr:      commits, pushes, and creates PR from an existing worktree (use after --watch)
# --cleanup: removes worktree and branch if the PR has been merged
# --revise:  apply revision feedback from issue comments on top of existing worktree

ISSUE_NUM="${1:?Usage: fix-issue.sh <issue-number> [--watch|--pr|--cleanup]}"
MODE="${2:-headless}"
# Always resolve to the MAIN repo root, even if invoked from a worktree.
REPO_ROOT="$(cd "$(dirname "$0")/.." && git worktree list --porcelain | head -1 | sed 's/^worktree //')"
BRANCH="fix-issue-${ISSUE_NUM}"
LOG_FILE="${HOME}/.treenote-autofix.log"

# Max time to wait for Claude to finish (30 minutes)
CLAUDE_TIMEOUT=1800

# Only process issues from trusted users (prompt injection defense)
ALLOWED_AUTHORS="oxue"

cd "$REPO_ROOT"

# Logging helper — writes to log file only.
# When called by daemon, stdout also goes to log file via tee, so we only write once.
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [issue-${ISSUE_NUM}] $*"
  echo "$msg" >> "$LOG_FILE"
}

# Fetch issue details
log "Fetching issue #${ISSUE_NUM}..."
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --json title,body,labels,author)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')
ISSUE_AUTHOR=$(echo "$ISSUE_JSON" | jq -r '.author.login')

log "Issue: $ISSUE_TITLE (by $ISSUE_AUTHOR)"

# Security: only process issues from trusted authors
if ! echo "$ALLOWED_AUTHORS" | tr ' ' '\n' | grep -qx "$ISSUE_AUTHOR"; then
  log "BLOCKED: issue #${ISSUE_NUM} authored by '$ISSUE_AUTHOR' — not in allowed list. Skipping."
  gh issue edit "$ISSUE_NUM" --remove-label "autofix" --remove-label "revise" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
  exit 1
fi

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
    NO_COMMIT_BODY="### Autofix agent ran but produced no commits

The agent created a worktree but did not commit any changes.
"
    # Check if there were uncommitted changes that failed to commit
    UNCOMMITTED=$(cd "$worktree_path" && git status --porcelain 2>/dev/null || true)
    if [ -n "$UNCOMMITTED" ]; then
      NO_COMMIT_BODY+="
Uncommitted files found in worktree:
\`\`\`
${UNCOMMITTED}
\`\`\`
"
    fi
    if [ -n "${SAVED_CLAUDE_RESULT:-}" ]; then
      NO_COMMIT_BODY+="
<details>
<summary>Agent output</summary>

\`\`\`
${SAVED_CLAUDE_RESULT}
\`\`\`
</details>"
    fi
    gh issue comment "$ISSUE_NUM" --body "$NO_COMMIT_BODY" --repo "oxue/treenote" >/dev/null 2>&1 || true
    gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
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
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --add-label "pr-pending" --repo "oxue/treenote" >/dev/null 2>&1 || true

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
    git branch -D "worktree-${BRANCH}" >/dev/null 2>&1 || true
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

# --revise mode: apply PR feedback on top of existing worktree
# In this mode, ISSUE_NUM is actually the PR number (passed by the daemon)
if [ "$MODE" = "--revise" ]; then
  PR_NUMBER="$ISSUE_NUM"
  log "Revising PR #${PR_NUMBER}..."

  # Get PR details: branch name, linked issue, body
  PR_JSON=$(gh pr view "$PR_NUMBER" --repo "oxue/treenote" --json headRefName,body,author 2>/dev/null)
  PR_HEAD=$(echo "$PR_JSON" | jq -r '.headRefName')
  PR_AUTHOR=$(echo "$PR_JSON" | jq -r '.author.login')

  # Derive the worktree branch from the PR head ref (e.g. worktree-fix-issue-41 -> fix-issue-41)
  BRANCH=$(echo "$PR_HEAD" | sed 's/^worktree-//')
  WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"

  # Extract linked issue number from PR body ("Closes #N")
  LINKED_ISSUE=$(echo "$PR_JSON" | jq -r '.body' | grep -oE 'Closes #[0-9]+' | head -1 | grep -oE '[0-9]+' || true)

  if [ ! -d "$WORKTREE_PATH" ]; then
    log "No worktree found at ${WORKTREE_PATH} — cannot revise."
    gh pr comment "$PR_NUMBER" \
      --body "### Revision failed

No existing worktree found. The worktree may have been cleaned up." \
      --repo "oxue/treenote" >/dev/null 2>&1 || true
    gh pr edit "$PR_NUMBER" --remove-label "revise" --repo "oxue/treenote" >/dev/null 2>&1 || true
    exit 1
  fi

  # Update labels on the PR
  gh pr edit "$PR_NUMBER" --remove-label "revise" --add-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true

  # Build jq author filter from allowed list (e.g. "oxue user2" -> '.author.login == "oxue" or .author.login == "user2"')
  AUTHOR_FILTER=""
  USER_FILTER=""
  for author in $ALLOWED_AUTHORS; do
    [ -n "$AUTHOR_FILTER" ] && AUTHOR_FILTER="$AUTHOR_FILTER or "
    AUTHOR_FILTER="${AUTHOR_FILTER}.author.login == \"${author}\""
    [ -n "$USER_FILTER" ] && USER_FILTER="$USER_FILTER or "
    USER_FILTER="${USER_FILTER}.user.login == \"${author}\""
  done

  # PR conversation comments (trusted authors only)
  PR_COMMENTS=$(gh pr view "$PR_NUMBER" --repo "oxue/treenote" --json comments \
    --jq "[.comments[] | select(${AUTHOR_FILTER}) | \"**\\(.author.login)** (\\(.createdAt)):\\n\\(.body)\"] | join(\"\\n\\n---\\n\\n\")" 2>/dev/null || true)

  # PR review comments (inline code review comments)
  REVIEW_COMMENTS=$(gh api "repos/oxue/treenote/pulls/${PR_NUMBER}/comments" \
    --jq "[.[] | select(${USER_FILTER}) | \"**\\(.user.login)** on \`\\(.path)\` line \\(.line // .original_line):\\n\\(.body)\"] | join(\"\\n\\n---\\n\\n\")" 2>/dev/null || true)

  # PR review bodies (the top-level review message when submitting a review)
  REVIEW_BODIES=$(gh api "repos/oxue/treenote/pulls/${PR_NUMBER}/reviews" \
    --jq "[.[] | select(${USER_FILTER}) | select(.body != null and .body != \"\") | \"**\\(.user.login)** (\\(.state)):\\n\\(.body)\"] | join(\"\\n\\n---\\n\\n\")" 2>/dev/null || true)

  # Combine all feedback
  COMMENTS="${PR_COMMENTS}"
  [ -n "$REVIEW_COMMENTS" ] && COMMENTS="${COMMENTS}

---

### Inline code review comments:
${REVIEW_COMMENTS}"
  [ -n "$REVIEW_BODIES" ] && COMMENTS="${COMMENTS}

---

### Review summaries:
${REVIEW_BODIES}"

  if [ -z "$COMMENTS" ]; then
    log "No feedback comments found on PR #${PR_NUMBER}."
    gh pr comment "$PR_NUMBER" --body "### Revision skipped

No review feedback found from trusted authors. Add a comment describing what to change, then re-add the \`revise\` label." \
      --repo "oxue/treenote" >/dev/null 2>&1 || true
    gh pr edit "$PR_NUMBER" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
    exit 1
  fi

  # Get the diff of what's already been done
  EXISTING_DIFF=$(cd "$WORKTREE_PATH" && git diff master..HEAD 2>/dev/null || true)

  # Fetch the original issue context if we have a linked issue
  ISSUE_CONTEXT=""
  if [ -n "$LINKED_ISSUE" ]; then
    ISSUE_CONTEXT="## Original Issue #${LINKED_ISSUE}: ${ISSUE_TITLE}

${ISSUE_BODY}"
  fi

  REVISE_PROMPT="You are revising a fix for a bug in the treenote project. A previous attempt has already been made and PR #${PR_NUMBER} exists. The reviewer has left feedback.

${ISSUE_CONTEXT}

## Feedback from reviewer (PR #${PR_NUMBER})

${COMMENTS}

## What's already been changed (diff from master)

\`\`\`diff
${EXISTING_DIFF}
\`\`\`

## Instructions
1. Read the feedback carefully — it tells you what to change.
2. Look at the existing code in this worktree (it already has the prior fix applied).
3. Apply the requested revisions on top of the existing work.
4. Run \`npm run build\` to verify the build passes.
5. Keep changes focused on the feedback.
6. If there's an existing Playwright test, update it if needed and re-run it."

  # Copy .env if missing
  if [ -f "$REPO_ROOT/.env" ] && [ ! -f "$WORKTREE_PATH/.env" ]; then
    cp "$REPO_ROOT/.env" "$WORKTREE_PATH/.env"
  fi

  # Run Claude in the existing worktree (cd into it, not --worktree flag)
  CONVERSATION_LOG=$(mktemp /tmp/claude-revise-${PR_NUMBER}-XXXXXX)
  TIMED_OUT=false

  cd "$WORKTREE_PATH"
  claude -p "$REVISE_PROMPT" \
    --dangerously-skip-permissions \
    --max-turns 50 \
    --output-format json > "$CONVERSATION_LOG" 2>&1 &
  CLAUDE_PID=$!
  log "Revision: Claude started with PID ${CLAUDE_PID} in worktree ${WORKTREE_PATH}"

  # Monitor with hard timeout
  ELAPSED=0
  CHECK_INTERVAL=30
  while kill -0 "$CLAUDE_PID" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    if [ "$ELAPSED" -ge "$CLAUDE_TIMEOUT" ]; then
      log "Claude PID ${CLAUDE_PID} exceeded hard timeout (${CLAUDE_TIMEOUT}s). Killing."
      kill "$CLAUDE_PID" >/dev/null 2>&1 || true
      sleep 2
      kill -9 "$CLAUDE_PID" >/dev/null 2>&1 || true
      TIMED_OUT=true
      break
    fi
    if [ $((ELAPSED % 300)) -eq 0 ]; then
      log "Revision: Claude PID ${CLAUDE_PID} still running (${ELAPSED}s elapsed)..."
    fi
  done

  wait "$CLAUDE_PID" >/dev/null 2>&1 || true

  if [ "$TIMED_OUT" = true ]; then
    log "Claude timed out during revision of PR #${PR_NUMBER}."
    CLAUDE_RESULT=$(jq -r '.result // empty' "$CONVERSATION_LOG" 2>/dev/null || true)
    TIMEOUT_BODY="### Revision timed out

Exceeded ${CLAUDE_TIMEOUT}s limit."
    if [ -n "$CLAUDE_RESULT" ]; then
      TIMEOUT_BODY+="
<details>
<summary>Agent output before timeout</summary>

\`\`\`
${CLAUDE_RESULT:0:3000}
\`\`\`
</details>"
    fi
    gh pr comment "$PR_NUMBER" --body "$TIMEOUT_BODY" --repo "oxue/treenote" >/dev/null 2>&1 || true
    gh pr edit "$PR_NUMBER" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
    rm -f "$CONVERSATION_LOG"
    exit 1
  fi

  rm -f "$CONVERSATION_LOG"

  # Commit, push, update PR
  cd "$WORKTREE_PATH"
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "fix: revise PR #${PR_NUMBER} — address review feedback"
  fi

  COMMITS_AHEAD=$(git rev-list --count master..HEAD 2>/dev/null || echo "0")
  if [ "$COMMITS_AHEAD" -gt 0 ]; then
    log "Pushing revision for PR #${PR_NUMBER}..."
    git push 2>/dev/null || git push -u origin HEAD
    log "Revision pushed for PR #${PR_NUMBER}."

    # Upload new video proof if tests were re-run
    upload_video_proof "$PR_NUMBER" "$WORKTREE_PATH"
  else
    log "No new commits after revision of PR #${PR_NUMBER}."
  fi

  gh pr edit "$PR_NUMBER" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
  log "Revision done for PR #${PR_NUMBER}."
  exit 0
fi

# --- Headless mode ---

# Check if this issue has exceeded max retries
if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
  log "Issue #${ISSUE_NUM} has already been retried ${RETRY_COUNT} times (max ${MAX_RETRIES}). Marking as needs-human."
  gh issue comment "$ISSUE_NUM" \
    --body "Autofix agent failed after ${RETRY_COUNT} attempts. Marking for human review." \
    --repo "oxue/treenote" >/dev/null 2>&1 || true
  gh issue edit "$ISSUE_NUM" \
    --remove-label "in-progress" \
    --remove-label "autofix" \
    --add-label "needs-human" \
    --repo "oxue/treenote" >/dev/null 2>&1 || true
  exit 1
fi

# Label as in-progress
gh issue edit "$ISSUE_NUM" --add-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true

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
  gh issue edit "$ISSUE_NUM" --remove-label "retry-${RETRY_COUNT}" --repo "oxue/treenote" >/dev/null 2>&1 || true
fi
if [ "$NEXT_RETRY" -le "$MAX_RETRIES" ]; then
  gh issue edit "$ISSUE_NUM" --add-label "retry-${NEXT_RETRY}" --repo "oxue/treenote" >/dev/null 2>&1 || true
fi

# Run Claude in a worktree
log "Spawning Claude in worktree '${BRANCH}' (attempt $((RETRY_COUNT + 1)) of $((MAX_RETRIES + 1)))..."
if [ "$MODE" = "--watch" ]; then
  # Interactive: open Claude with full UI in a new tmux window
  PROMPT_FILE=$(mktemp)
  printf '%s' "$PROMPT" > "$PROMPT_FILE"
  # Copy .env after a short delay to let worktree be created
  (sleep 5 && cp "$REPO_ROOT/.env" "$REPO_ROOT/.claude/worktrees/${BRANCH}/.env" >/dev/null 2>&1 || true) &
  tmux new-window -n "fix-#${ISSUE_NUM}" \
    "cd '$REPO_ROOT' && claude --worktree '$BRANCH' --dangerously-skip-permissions \"\$(cat '$PROMPT_FILE')\"; rm -f '$PROMPT_FILE'"
  log "Opened in tmux window 'fix-#${ISSUE_NUM}'."
  log "When it's done, create the PR with: ./scripts/fix-issue.sh ${ISSUE_NUM} --pr"
  exit 0
else
  # Headless mode: run with timeout + stuck-detection
  CONVERSATION_LOG=$(mktemp /tmp/claude-issue-${ISSUE_NUM}-XXXXXX)
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

  # Monitor Claude: enforce hard timeout only.
  # Note: stuck detection based on log file modification doesn't work with
  # --output-format json, which writes nothing until Claude finishes.
  ELAPSED=0
  CHECK_INTERVAL=30
  while kill -0 "$CLAUDE_PID" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))

    if [ "$ELAPSED" -ge "$CLAUDE_TIMEOUT" ]; then
      log "Claude PID ${CLAUDE_PID} exceeded hard timeout (${CLAUDE_TIMEOUT}s). Killing."
      kill "$CLAUDE_PID" >/dev/null 2>&1 || true
      sleep 2
      kill -9 "$CLAUDE_PID" >/dev/null 2>&1 || true
      TIMED_OUT=true
      break
    fi

    # Log progress every 5 minutes
    if [ $((ELAPSED % 300)) -eq 0 ]; then
      log "Claude PID ${CLAUDE_PID} still running (${ELAPSED}s elapsed)..."
    fi
  done

  # Wait for Claude to fully exit and capture exit code
  wait "$CLAUDE_PID" >/dev/null 2>&1 || true

  # Extract Claude's final result text from JSON output
  CLAUDE_RESULT=""
  if [ -f "$CONVERSATION_LOG" ] && [ -s "$CONVERSATION_LOG" ]; then
    # --output-format json produces a JSON object with a "result" field containing Claude's final response
    CLAUDE_RESULT=$(jq -r '.result // empty' "$CONVERSATION_LOG" 2>/dev/null || true)
    # If no .result field, try to get the raw text (fallback for non-JSON output)
    if [ -z "$CLAUDE_RESULT" ]; then
      CLAUDE_RESULT=$(tail -100 "$CONVERSATION_LOG" 2>/dev/null || true)
    fi
    # Truncate to 3000 chars to fit in a GitHub comment
    if [ ${#CLAUDE_RESULT} -gt 3000 ]; then
      CLAUDE_RESULT="${CLAUDE_RESULT:0:3000}... (truncated)"
    fi
  fi

  if [ "$TIMED_OUT" = true ]; then
    log "Claude timed out for issue #${ISSUE_NUM}."
    TIMEOUT_BODY="### Autofix agent timed out

Exceeded ${CLAUDE_TIMEOUT}s limit (attempt $((RETRY_COUNT + 1)) of $((MAX_RETRIES + 1))).
"
    if [ -n "$CLAUDE_RESULT" ]; then
      TIMEOUT_BODY+="
<details>
<summary>Agent output before timeout</summary>

\`\`\`
${CLAUDE_RESULT}
\`\`\`
</details>"
    fi
    gh issue comment "$ISSUE_NUM" \
      --body "$TIMEOUT_BODY" \
      --repo "oxue/treenote" >/dev/null 2>&1 || true
    gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
    rm -f "$CONVERSATION_LOG"
    exit 1
  fi

  # Save result for later use in failure reporting
  SAVED_CLAUDE_RESULT="$CLAUDE_RESULT"
  rm -f "$CONVERSATION_LOG"
  copy_env
fi

# Headless mode: auto-create PR
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"
if [ ! -d "$WORKTREE_PATH" ]; then
  log "No worktree created — Claude may not have made changes."
  NO_WT_BODY="### Autofix agent produced no changes

No worktree was created. The agent may have failed to understand the issue or encountered an error.
"
  if [ -n "${SAVED_CLAUDE_RESULT:-}" ]; then
    NO_WT_BODY+="
<details>
<summary>Agent output</summary>

\`\`\`
${SAVED_CLAUDE_RESULT}
\`\`\`
</details>"
  fi
  gh issue comment "$ISSUE_NUM" --body "$NO_WT_BODY" --repo "oxue/treenote" >/dev/null 2>&1 || true
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" >/dev/null 2>&1 || true
  exit 1
fi

create_pr "$WORKTREE_PATH"
