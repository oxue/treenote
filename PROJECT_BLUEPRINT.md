# Project Blueprint

A reusable template for setting up a new project with the full development infrastructure: Vite + React, Playwright testing with video proof, GitHub autofix pipeline with Claude Code worktrees, and Vercel deployment.

Feed this file to a Claude Code session and say: "Set up a new project following this blueprint."

---

## 1. Scaffold the project

```
mkdir -p ~/src/<project-name>
cd ~/src/<project-name>
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react @playwright/test
npx playwright install chromium
```

Create `vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PROJECT_NAME</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

Create `src/main.jsx`:
```jsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);
```

Create `src/App.jsx` with the app's main component.

Add scripts to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## 2. Git setup

```bash
git init
git branch -M master
```

Create `.gitignore`:
```
node_modules/
dist/
.claude/
.env
.env.local
test-results/
release/
```

Initial commit:
```bash
git add -A
git commit -m "feat: initial scaffold"
```

Create GitHub repo and push:
```bash
gh repo create <owner>/<project-name> --public --source=. --push
```

## 3. Playwright testing with video recording

Create `playwright.config.js`:
```js
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
```

Test files go in `tests/`. Pattern for mocking auth or external services:
```js
import { test, expect } from '@playwright/test';

async function setupMocks(page) {
  // Intercept API calls with page.route()
  await page.route('https://api.example.com/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: 'mocked' }),
    });
  });

  // Inject state into localStorage before page loads
  await page.addInitScript(() => {
    localStorage.setItem('auth-token', 'fake-token');
  });
}

test('feature works', async ({ page }) => {
  await setupMocks(page);
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app');
  // ... assertions
});
```

Run tests: `npx playwright test`

Video recordings are saved to `test-results/`.

## 4. Autofix pipeline scripts

### `scripts/fix-issue.sh`

Takes a GitHub issue number and spawns Claude Code in a git worktree to fix it. Creates a PR with video proof when done.

Modes:
- `./scripts/fix-issue.sh <N>` — headless: runs Claude, auto-creates PR
- `./scripts/fix-issue.sh <N> --watch` — interactive: opens Claude in a tmux window for observation
- `./scripts/fix-issue.sh <N> --pr` — creates PR from an existing worktree (use after --watch)
- `./scripts/fix-issue.sh <N> --cleanup` — removes worktree/branch after PR is merged

```bash
#!/bin/bash
set -euo pipefail

ISSUE_NUM="${1:?Usage: fix-issue.sh <issue-number> [--watch|--pr|--cleanup]}"
MODE="${2:-headless}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="fix/issue-${ISSUE_NUM}"
OWNER_REPO="OWNER/REPO"  # <-- CONFIGURE THIS

cd "$REPO_ROOT"

# Fetch issue details
ISSUE_JSON=$(gh issue view "$ISSUE_NUM" --json title,body,labels)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')

# --- Upload video proof as inline gifs on a PR ---
upload_video_proof() {
  local pr_number="$1"
  local worktree_path="$2"

  VIDEO_FILES=$(find "$worktree_path" -path '*/test-results/*' -name '*.webm' 2>/dev/null || true)
  if [ -z "$VIDEO_FILES" ]; then return; fi

  echo "Converting videos to gifs and uploading..."
  TOKEN=$(gh auth token)

  RELEASE_ID=$(curl -s \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${OWNER_REPO}/releases/tags/video-proof" 2>/dev/null | jq -r '.id // empty')

  if [ -z "$RELEASE_ID" ]; then
    RELEASE_ID=$(curl -s -X POST \
      -H "Authorization: token $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -d '{"tag_name":"video-proof","name":"Video Proof Assets","draft":true}' \
      "https://api.github.com/repos/${OWNER_REPO}/releases" | jq -r '.id')
  fi

  UPLOAD_URL="https://uploads.github.com/repos/${OWNER_REPO}/releases/${RELEASE_ID}/assets"
  COMMENT_BODY="## Video Proof"$'\n\n'
  INDEX=0

  while IFS= read -r webm_file; do
    INDEX=$((INDEX + 1))
    GIF_NAME="issue-${ISSUE_NUM}-${INDEX}.gif"
    GIF_PATH="/tmp/${GIF_NAME}"

    ffmpeg -y -i "$webm_file" \
      -vf "fps=10,scale=700:-1:flags=lanczos" -loop 0 \
      "$GIF_PATH" 2>/dev/null

    EXISTING_ASSET_ID=$(curl -s \
      -H "Authorization: token $TOKEN" \
      "https://api.github.com/repos/${OWNER_REPO}/releases/${RELEASE_ID}/assets" | \
      jq -r ".[] | select(.name==\"${GIF_NAME}\") | .id // empty")
    if [ -n "$EXISTING_ASSET_ID" ]; then
      curl -s -X DELETE \
        -H "Authorization: token $TOKEN" \
        "https://api.github.com/repos/${OWNER_REPO}/releases/assets/${EXISTING_ASSET_ID}" > /dev/null
    fi

    DL_URL=$(curl -s -X POST \
      "${UPLOAD_URL}?name=${GIF_NAME}" \
      -H "Authorization: token $TOKEN" \
      -H "Content-Type: image/gif" \
      --data-binary "@${GIF_PATH}" | jq -r '.browser_download_url')

    TEST_DIR=$(dirname "$webm_file")
    TEST_NAME=$(basename "$TEST_DIR" | sed "s/^issue-${ISSUE_NUM}-//" | tr '-' ' ')

    COMMENT_BODY+="### ${TEST_NAME}"$'\n'
    COMMENT_BODY+="![${GIF_NAME}](${DL_URL})"$'\n\n'
    rm -f "$GIF_PATH"
  done <<< "$VIDEO_FILES"

  COMMENT_BODY+="_Recorded by Playwright during automated testing._"
  gh pr comment "$pr_number" --body "$COMMENT_BODY" --repo "$OWNER_REPO"
}

# --- Commit, push, create PR ---
create_pr() {
  local worktree_path="$1"
  cd "$worktree_path"

  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "fix: resolve issue #${ISSUE_NUM} — ${ISSUE_TITLE}"
  fi

  COMMITS_AHEAD=$(git rev-list --count master..HEAD 2>/dev/null || echo "0")
  if [ "$COMMITS_AHEAD" -eq 0 ]; then
    echo "No commits to push."
    gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but produced no changes." --repo "$OWNER_REPO" 2>/dev/null || true
    gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --repo "$OWNER_REPO" 2>/dev/null || true
    exit 1
  fi

  git push -u origin "worktree-${BRANCH}" 2>/dev/null || git push -u origin HEAD

  EXISTING_PR=$(gh pr list --head "worktree-${BRANCH}" --json url --jq '.[0].url' --repo "$OWNER_REPO" 2>/dev/null || true)
  if [ -n "$EXISTING_PR" ]; then
    PR_URL="$EXISTING_PR"
  else
    PR_URL=$(gh pr create \
      --title "fix: ${ISSUE_TITLE}" \
      --body "Closes #${ISSUE_NUM}

Auto-generated fix by Claude Code agent.

## Issue
${ISSUE_BODY}" \
      --base master --repo "$OWNER_REPO")
  fi

  PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]*$')
  upload_video_proof "$PR_NUMBER" "$worktree_path"
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" --add-label "pr-pending" --repo "$OWNER_REPO" 2>/dev/null || true
  echo "Done! Issue #${ISSUE_NUM} → ${PR_URL}"
}

# --cleanup mode
if [ "$MODE" = "--cleanup" ]; then
  WORKTREE_PATH=".claude/worktrees/${BRANCH}"
  if [ ! -d "$WORKTREE_PATH" ]; then exit 0; fi
  PR_STATE=$(gh pr list --head "worktree-${BRANCH}" --state merged --json state --jq '.[0].state' --repo "$OWNER_REPO" 2>/dev/null || true)
  if [ "$PR_STATE" = "MERGED" ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -D "worktree-${BRANCH}" 2>/dev/null || true
    echo "Cleaned up worktree for issue #${ISSUE_NUM}."
  fi
  exit 0
fi

# --pr mode
if [ "$MODE" = "--pr" ]; then
  WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"
  [ ! -d "$WORKTREE_PATH" ] && echo "No worktree found." && exit 1
  create_pr "$WORKTREE_PATH"
  exit 0
fi

# Label as in-progress
gh issue edit "$ISSUE_NUM" --add-label "in-progress" 2>/dev/null || true

# Build the prompt
PROMPT="You are fixing a bug in the PROJECT_NAME project.

## GitHub Issue #${ISSUE_NUM}: ${ISSUE_TITLE}

${ISSUE_BODY}

## Instructions
1. Read the relevant code to understand the problem.
2. Implement a fix.
3. Run \`npm run build\` to verify the build passes.
4. Keep changes minimal and focused on the issue.

## Video Proof
After implementing the fix, create a Playwright test at \`tests/issue-${ISSUE_NUM}.spec.js\`.
Configure video recording in playwright.config.js with video: 'on'.
Run: \`npx playwright test tests/issue-${ISSUE_NUM}.spec.js\`"

# Copy .env to worktree
copy_env() {
  local wt="$REPO_ROOT/.claude/worktrees/${BRANCH}"
  if [ -d "$wt" ] && [ -f "$REPO_ROOT/.env" ] && [ ! -f "$wt/.env" ]; then
    cp "$REPO_ROOT/.env" "$wt/.env"
  fi
}

# Run Claude
if [ "$MODE" = "--watch" ]; then
  PROMPT_FILE=$(mktemp)
  printf '%s' "$PROMPT" > "$PROMPT_FILE"
  (sleep 5 && cp "$REPO_ROOT/.env" "$REPO_ROOT/.claude/worktrees/${BRANCH}/.env" 2>/dev/null || true) &
  tmux new-window -n "fix-#${ISSUE_NUM}" \
    "cd '$REPO_ROOT' && claude --worktree '$BRANCH' --dangerously-skip-permissions \"\$(cat '$PROMPT_FILE')\"; rm -f '$PROMPT_FILE'"
  echo "Opened in tmux window 'fix-#${ISSUE_NUM}'."
  echo "When done: ./scripts/fix-issue.sh ${ISSUE_NUM} --pr"
  exit 0
else
  claude -p "$PROMPT" \
    --worktree "$BRANCH" \
    --dangerously-skip-permissions \
    --max-turns 50 \
    --output-format json 2>/dev/null || true
  copy_env
fi

# Headless: auto-create PR
WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/${BRANCH}"
if [ ! -d "$WORKTREE_PATH" ]; then
  gh issue comment "$ISSUE_NUM" --body "Autofix agent ran but did not produce changes." --repo "$OWNER_REPO"
  gh issue edit "$ISSUE_NUM" --remove-label "in-progress" 2>/dev/null || true
  exit 1
fi
create_pr "$WORKTREE_PATH"
```

### `scripts/autofix-daemon.sh`

Polls for open issues labeled `autofix` every hour. Run in tmux: `tmux new-window -n autofix './scripts/autofix-daemon.sh'`

```bash
#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER_REPO="OWNER/REPO"  # <-- CONFIGURE THIS
INTERVAL=3600

cd "$REPO_ROOT"
echo "Autofix daemon started. Polling every ${INTERVAL}s."

while true; do
  echo "=== $(date) — Checking for issues ==="
  ISSUES=$(gh issue list \
    --repo "$OWNER_REPO" \
    --state open \
    --label autofix \
    --json number,title,labels \
    --jq '.[] | select(.labels | map(.name) | (contains(["in-progress"]) or contains(["pr-pending"])) | not) | .number' 2>/dev/null || true)

  if [ -z "$ISSUES" ]; then
    echo "No new issues."
  else
    while IFS= read -r issue_num; do
      echo "--- Processing issue #${issue_num} ---"
      ./scripts/fix-issue.sh "$issue_num" || echo "Issue #${issue_num} failed."
    done <<< "$ISSUES"
  fi

  sleep "$INTERVAL"
done
```

## 5. GitHub labels

Create these labels on your repo for the pipeline:
```bash
gh label create autofix --color 0E8A16 --description "Auto-fixable by Claude" --repo OWNER/REPO
gh label create in-progress --color FBCA04 --description "Agent is working on it" --repo OWNER/REPO
gh label create pr-pending --color 1D76DB --description "PR created, awaiting review" --repo OWNER/REPO
```

## 6. Prerequisites

The machine running this needs:
- `node` / `npm`
- `gh` (GitHub CLI, authenticated via `gh auth login`)
- `jq`
- `ffmpeg` (for video-to-gif conversion)
- `tmux` (for --watch mode and daemon)
- `claude` (Claude Code CLI)

## 7. Configuration checklist

Before using the autofix pipeline, replace these placeholders:
- [ ] `OWNER/REPO` in both scripts → your GitHub `owner/repo`
- [ ] `PROJECT_NAME` in the fix-issue prompt
- [ ] `master` → your default branch name if different

## 8. Workflow

1. Create a GitHub issue describing a bug
2. Add the `autofix` label
3. Either wait for the daemon or run manually: `./scripts/fix-issue.sh <N> --watch`
4. Observe in tmux, then `./scripts/fix-issue.sh <N> --pr` to create the PR
5. Review PR (includes inline gif proof), merge
6. `./scripts/fix-issue.sh <N> --cleanup` to remove the worktree
