#!/usr/bin/env bash
# Stop my-service gracefully
set -euo pipefail

PIDFILE="/tmp/my-service.pid"

if [[ ! -f "$PIDFILE" ]]; then
  echo "my-service is not running (no pidfile found)"
  exit 0
fi

PID="$(cat "$PIDFILE")"

if ! kill -0 "$PID" 2>/dev/null; then
  echo "my-service is not running (stale pidfile, pid $PID)"
  rm -f "$PIDFILE"
  exit 0
fi

kill -TERM "$PID"
rm -f "$PIDFILE"
echo "my-service stopped (pid $PID)"
