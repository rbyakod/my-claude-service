#!/usr/bin/env bash
# Start my-service in the background, logging to /tmp/my-service.log
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PIDFILE="/tmp/my-service.pid"
LOGFILE="/tmp/my-service.log"

if [[ -f "$PIDFILE" ]]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "my-service is already running (pid $PID)"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

cd "$ROOT"
nohup node src/index.js >> "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
echo "my-service started (pid $!, log: $LOGFILE)"
