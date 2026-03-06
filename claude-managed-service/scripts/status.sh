#!/usr/bin/env bash
# Quick health check — Claude can run this to confirm the service is up
set -euo pipefail

PORT=$(node -e "console.log(require('./config/default.json').port)" 2>/dev/null || echo 3000)
URL="http://localhost:${PORT}/health"

if curl -sf "$URL" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ const j=JSON.parse(d); console.log('status:', j.status, '| uptime:', j.uptime+'s', '| tasks:', j.tasks); })"; then
  echo "Service is healthy on port ${PORT}"
else
  echo "Service is NOT reachable on port ${PORT}" >&2
  exit 1
fi
