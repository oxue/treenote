#!/bin/bash
set -euo pipefail

# Manages the autofix daemon as a macOS launchd service.
# Usage:
#   ./scripts/autofix-launchd.sh start    — install and start the daemon
#   ./scripts/autofix-launchd.sh stop     — stop and uninstall the daemon
#   ./scripts/autofix-launchd.sh status   — check if running
#   ./scripts/autofix-launchd.sh logs     — tail the log file
#   ./scripts/autofix-launchd.sh cleanup  — interactive cleanup of non-issue worktrees

LABEL="com.treenote.autofix"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$HOME/.treenote-autofix.log"

case "${1:-}" in
  start)
    # Kill any existing manual runs
    pkill -f "autofix-daemon.sh" 2>/dev/null || true

    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${REPO_ROOT}/scripts/autofix-daemon.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/oliverxu/.nvm/versions/node/v23.6.0/bin:/Users/oliverxu/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/oliverxu/.cargo/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PLISTEOF

    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "Autofix daemon started. Survives terminal close, sleep, and reboot."
    echo "Logs: tail -f $LOG_FILE"
    ;;

  stop)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Autofix daemon stopped and uninstalled."
    ;;

  status)
    if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
      echo "Running."
      launchctl print "gui/$(id -u)/${LABEL}" 2>/dev/null | grep -E "pid|state|last exit"
    else
      echo "Not running."
    fi
    ;;

  logs)
    tail -f "$LOG_FILE"
    ;;

  cleanup)
    echo "=== Worktree Cleanup ==="
    echo ""

    # Auto-clean merged fix/issue-* worktrees
    CLEANED=0
    for wt_path in "$REPO_ROOT"/.claude/worktrees/fix/issue-*; do
      [ -d "$wt_path" ] || continue
      issue_num=$(basename "$wt_path" | sed 's/issue-//')
      BRANCH="fix/issue-${issue_num}"
      PR_STATE=$(gh pr list --head "worktree-${BRANCH}" --state merged --json state --jq '.[0].state' --repo "oxue/treenote" 2>/dev/null || true)
      if [ "$PR_STATE" = "MERGED" ]; then
        echo "Removing fix/issue-${issue_num} (PR merged)"
        git worktree remove "$wt_path" --force 2>/dev/null || rm -rf "$wt_path"
        git branch -D "worktree-${BRANCH}" 2>/dev/null || true
        CLEANED=$((CLEANED + 1))
      fi
    done
    git worktree prune 2>/dev/null || true
    echo "Auto-cleaned ${CLEANED} merged issue worktrees."
    echo ""

    # List non-issue worktrees for manual review
    echo "=== Non-issue worktrees (manual cleanup) ==="
    MANUAL_WTS=()
    while IFS= read -r line; do
      wt_path=$(echo "$line" | awk '{print $1}')
      wt_branch=$(echo "$line" | sed 's/.*\[//' | sed 's/\]//')
      # Skip main repo and fix/issue-* paths
      case "$wt_path" in
        "$REPO_ROOT") continue ;;
        *fix/issue-*) continue ;;
      esac
      MANUAL_WTS+=("$wt_path|$wt_branch")
    done < <(git worktree list)

    if [ ${#MANUAL_WTS[@]} -eq 0 ]; then
      echo "None found."
    else
      for i in "${!MANUAL_WTS[@]}"; do
        IFS='|' read -r path branch <<< "${MANUAL_WTS[$i]}"
        rel_path="${path#$REPO_ROOT/}"
        echo "  [$((i+1))] $rel_path  ($branch)"
      done
      echo ""
      echo "Enter numbers to remove (space-separated), or 'all', or 'skip':"
      read -r choice
      if [ "$choice" = "skip" ] || [ -z "$choice" ]; then
        echo "Skipped."
      elif [ "$choice" = "all" ]; then
        for entry in "${MANUAL_WTS[@]}"; do
          IFS='|' read -r path branch <<< "$entry"
          echo "Removing $path..."
          git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
          git branch -D "$branch" 2>/dev/null || true
        done
        git worktree prune 2>/dev/null || true
        echo "Done."
      else
        for num in $choice; do
          idx=$((num - 1))
          if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#MANUAL_WTS[@]}" ]; then
            IFS='|' read -r path branch <<< "${MANUAL_WTS[$idx]}"
            echo "Removing $path..."
            git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
            git branch -D "$branch" 2>/dev/null || true
          fi
        done
        git worktree prune 2>/dev/null || true
        echo "Done."
      fi
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|status|logs|cleanup}"
    exit 1
    ;;
esac
