#!/bin/bash
set -euo pipefail

# Manages the autofix daemon as a macOS launchd service.
# Usage:
#   ./scripts/autofix-launchd.sh start    — install and start the daemon
#   ./scripts/autofix-launchd.sh stop     — stop and uninstall the daemon
#   ./scripts/autofix-launchd.sh status   — check if running
#   ./scripts/autofix-launchd.sh logs     — tail the log file

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

  *)
    echo "Usage: $0 {start|stop|status|logs}"
    exit 1
    ;;
esac
