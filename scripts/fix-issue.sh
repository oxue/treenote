#!/bin/bash
set -euo pipefail

# Usage: ./scripts/fix-issue.sh <issue-number> [--watch]
# Picks up a GitHub issue, spawns Claude in a worktree to fix it, and creates a PR.
# --watch: opens Claude in a new tmux window so you can watch it work (interactive mode)

ISSUE_NUM="${1:?Usage: fix-issue.sh <issue-number> [--watch]}"
WATCH=false
if [ "${2:-}" = "--watch" ]; then WATCH=true; fi
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="fix/issue-${ISSUE_NUM}"

cd "$REPO_ROOT"

# Fetch issue details
echo "Fetching issue #${ISSUE_NUM}..."
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --json title,body,labels)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')

echo "Issue: $ISSUE_TITLE"

# Label as in-progress
gh issue edit "$ISSUE_NUM" --add-label "in-progress" 2>/dev/null || true

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

# Run Claude in a worktree
echo "Spawning Claude in worktree '${BRANCH}'..."
if [ "$WATCH" = true ]; then
  # Interactive: open Claude with full UI in a new tmux window
  PROMPT_FILE=$(mktemp)
  printf '%s' "$PROMPT" > "$PROMPT_FILE"
  # Copy .env after a short delay to let worktree be created
  (sleep 5 && cp "$REPO_ROOT/.env" "$REPO_ROOT/.claude/worktrees/${BRANCH}/.env" 2>/dev/null || true) &
  tmux new-window -n "fix-#${ISSUE_NUM}" \
    "cd '$REPO_ROOT' && claude --worktree '$BRANCH' --dangerously-skip-permissions \"\$(cat '$PROMPT_FILE')\"; rm -f '$PROMPT_FILE'"
  echo "Opened in tmux window 'fix-#${ISSUE_NUM}'."
  echo "When it's done, create the PR with: ./scripts/fix-issue.sh ${ISSUE_NUM} --pr"
  exit 0
else
  RESULT=$(claude -p "$PROMPT" \
    --worktree "$BRANCH" \
    --dangerously-skip-permissions \
    --max-turns 50 \
    --output-format json 2>/dev/null) || true
  copy_env
fi

# Check if Claude made changes
WORKTREE_PATH=".claude/worktrees/${BRANCH}"
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "No worktree created — Claude may not have made changes."
  gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but did not produce changes. Manual review needed."
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" 2>/dev/null || true
  exit 1
fi

cd "$WORKTREE_PATH"

# Find video recording if it exists
VIDEO_FILE=$(find . -path '*/test-results/*' -name '*.webm' 2>/dev/null | head -1)

# Check for uncommitted changes and commit them
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "fix: resolve issue #${ISSUE_NUM} — ${ISSUE_TITLE}"
fi

# Check if there are commits ahead of master
COMMITS_AHEAD=$(git rev-list --count master..HEAD 2>/dev/null || echo "0")
if [ "$COMMITS_AHEAD" -eq 0 ]; then
  echo "No new commits — nothing to push."
  gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but produced no changes. Manual review needed." --repo "oxue/treenote"
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "oxue/treenote" 2>/dev/null || true
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
  exit 1
fi

# Push and create PR
echo "Pushing branch and creating PR..."
git push -u origin "$BRANCH"

PR_BODY="Closes #${ISSUE_NUM}

Auto-generated fix by Claude Code agent.

## Issue
${ISSUE_BODY}"

PR_URL=$(gh pr create \
  --title "fix: ${ISSUE_TITLE}" \
  --body "$PR_BODY" \
  --base master \
  --head "$BRANCH" \
  --repo "oxue/treenote")

echo "PR created: $PR_URL"

# Upload video proof if available
if [ -n "$VIDEO_FILE" ] && [ -f "$VIDEO_FILE" ]; then
  echo "Uploading video proof..."
  # gh doesn't support file attachments in comments directly,
  # so we upload to a GitHub issue comment using the API
  VIDEO_BASENAME=$(basename "$VIDEO_FILE")

  # Upload the video as a release asset (workaround for comment attachments)
  # Instead, we'll create a gist-like approach: encode and link
  # Simplest: upload via gh api
  PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]*$')

  # Use GitHub's uploads API to attach video
  UPLOAD_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $(gh auth token)" \
    -H "Accept: application/vnd.github+json" \
    -F "file=@${VIDEO_FILE}" \
    "https://uploads.github.com/repos/oxue/treenote/issues/${PR_NUMBER}/comments" 2>/dev/null) || true

  # Fallback: comment with a note about the video
  if [ -n "$PR_NUMBER" ]; then
    # Copy video to a publicly accessible location or just note it
    gh pr comment "$PR_NUMBER" --body "## Video Proof

A Playwright test with video recording was created to demonstrate this fix works.

To view the recording locally:
\`\`\`
cd .claude/worktrees/${BRANCH}
open ${VIDEO_FILE}
\`\`\`

Test file: \`tests/issue-${ISSUE_NUM}.spec.js\`" --repo "oxue/treenote"
  fi
  echo "Video proof noted on PR."
else
  echo "No video recording found."
fi

# Update issue labels
gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --add-label "pr-pending" --repo "oxue/treenote" 2>/dev/null || true

# Don't clean up worktree so video can be viewed
echo "Done! Issue #${ISSUE_NUM} → ${PR_URL}"
echo "Worktree kept at: ${WORKTREE_PATH} (for video viewing)"
