#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# create-claude-managed-service.sh
#
# Creates a complete Claude-managed service project from scratch.
# Usage: bash create-claude-managed-service.sh [target-directory]
#
# Default target: ./claude-managed-service
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TARGET="${1:-./claude-managed-service}"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
info() { echo -e "${BLUE}${BOLD}==> $*${RESET}"; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
info "Pre-flight checks"
node_ver=$(node --version 2>/dev/null || echo "none")
if [[ "$node_ver" == "none" ]]; then
  echo "ERROR: Node.js is not installed. Install Node >= 20 first." >&2; exit 1
fi
major=$(echo "$node_ver" | sed 's/v\([0-9]*\).*/\1/')
if (( major < 20 )); then
  echo "ERROR: Node.js $node_ver found, but >= 20 is required." >&2; exit 1
fi
ok "Node.js $node_ver"

if [[ -d "$TARGET" ]]; then
  echo "ERROR: Directory '$TARGET' already exists. Choose a different name." >&2; exit 1
fi

# ── Scaffold ──────────────────────────────────────────────────────────────────
info "Creating project at $TARGET"
mkdir -p \
  "$TARGET/src/routes" \
  "$TARGET/config" \
  "$TARGET/data" \
  "$TARGET/deploy" \
  "$TARGET/scripts" \
  "$TARGET/.claude/skills/setup" \
  "$TARGET/.claude/skills/debug" \
  "$TARGET/.claude/skills/add-feature" \
  "$TARGET/.claude/skills/add-webhook"
ok "Directory structure created"

# ─────────────────────────────────────────────────────────────────────────────
# Helper: write a file, creating parent dirs if needed
# Usage: write_file <path> <<'EOF' ... EOF
# ─────────────────────────────────────────────────────────────────────────────
write_file() { cat > "$TARGET/$1"; }

# ── package.json ─────────────────────────────────────────────────────────────
info "Writing package.json"
write_file "package.json" <<'JSONEOF'
{
  "name": "my-service",
  "version": "1.0.0",
  "description": "A Claude-managed task-queue HTTP service",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev":   "node --watch src/index.js"
  },
  "engines": {
    "node": ">=20"
  }
}
JSONEOF
ok "package.json"

# ── config/default.json ───────────────────────────────────────────────────────
info "Writing config"
write_file "config/default.json" <<'JSONEOF'
{
  "port": 3000,
  "logLevel": "info",
  "maxTasks": 1000,
  "dataDir": "./data"
}
JSONEOF
ok "config/default.json"

# ── src/config.js ─────────────────────────────────────────────────────────────
info "Writing src/"
write_file "src/config.js" <<'JSEOF'
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configPath = resolve(process.cwd(), 'config/default.json');

function loadConfig() {
  try {
    const raw = readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg.port || typeof cfg.port !== 'number')
      throw new Error('config.port must be a number');
    if (!cfg.maxTasks || typeof cfg.maxTasks !== 'number')
      throw new Error('config.maxTasks must be a number');
    return cfg;
  } catch (err) {
    console.error(`[config] Failed to load ${configPath}: ${err.message}`);
    process.exit(1);
  }
}

export const config = loadConfig();
JSEOF

# ── src/logger.js ─────────────────────────────────────────────────────────────
write_file "src/logger.js" <<'JSEOF'
import { config } from './config.js';

const LEVELS = { error: 0, info: 1, debug: 2 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, msg, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  process.stdout.write(JSON.stringify({
    ts: new Date().toISOString(), level, msg, ...meta,
  }) + '\n');
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
JSEOF

# ── src/store.js ──────────────────────────────────────────────────────────────
write_file "src/store.js" <<'JSEOF'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';
import { logger } from './logger.js';

const dataDir  = resolve(process.cwd(), config.dataDir);
const dataFile = resolve(dataDir, 'tasks.json');

function ensureDataDir() {
  if (!existsSync(dataDir))  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(dataFile)) writeFileSync(dataFile, '[]', 'utf8');
}

function readTasks() {
  ensureDataDir();
  try { return JSON.parse(readFileSync(dataFile, 'utf8')); }
  catch { logger.error('store: corrupt data file, resetting'); return []; }
}

function writeTasks(tasks) {
  ensureDataDir();
  writeFileSync(dataFile, JSON.stringify(tasks, null, 2), 'utf8');
}

export const store = {
  list(statusFilter) {
    const tasks = readTasks();
    return statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;
  },
  get(id)  { return readTasks().find(t => t.id === id) ?? null; },
  count()  { return readTasks().length; },

  create({ title, priority = 'normal' }) {
    const tasks = readTasks();
    if (tasks.length >= config.maxTasks)
      throw new Error(`Task limit reached (max ${config.maxTasks})`);
    const task = {
      id: crypto.randomUUID(), title, priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(task);
    writeTasks(tasks);
    logger.info('store: task created', { id: task.id });
    return task;
  },

  update(id, patch) {
    const tasks = readTasks();
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
    writeTasks(tasks);
    logger.info('store: task updated', { id });
    return tasks[idx];
  },

  delete(id) {
    const tasks = readTasks();
    const next  = tasks.filter(t => t.id !== id);
    if (next.length === tasks.length) return false;
    writeTasks(next);
    logger.info('store: task deleted', { id });
    return true;
  },
};
JSEOF

# ── src/routes/health.js ──────────────────────────────────────────────────────
write_file "src/routes/health.js" <<'JSEOF'
import { store } from '../store.js';

const startedAt = Date.now();

export function handleHealth(_req, res) {
  const body = JSON.stringify({
    status:  'ok',
    uptime:  Math.floor((Date.now() - startedAt) / 1000),
    tasks:   store.count(),
    version: process.env.npm_package_version ?? '1.0.0',
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(body);
}
JSEOF

# ── src/routes/tasks.js ───────────────────────────────────────────────────────
write_file "src/routes/tasks.js" <<'JSEOF'
import { store }  from '../store.js';
import { logger } from '../logger.js';

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export async function handleTasks(req, res, urlParts) {
  const method = req.method;
  const id     = urlParts[2];

  try {
    if (method === 'GET' && !id) {
      const status = new URL(req.url, 'http://x').searchParams.get('status');
      return json(res, 200, store.list(status));
    }
    if (method === 'POST' && !id) {
      const body = await readBody(req);
      if (!body.title || typeof body.title !== 'string')
        return json(res, 400, { error: 'title is required and must be a string' });
      const valid = ['low','normal','high'];
      if (body.priority && !valid.includes(body.priority))
        return json(res, 400, { error: `priority must be one of: ${valid.join(', ')}` });
      return json(res, 201, store.create({ title: body.title.trim(), priority: body.priority }));
    }
    if (method === 'PATCH' && id) {
      const body = await readBody(req);
      const valid = ['pending','in_progress','done','failed'];
      if (body.status && !valid.includes(body.status))
        return json(res, 400, { error: `status must be one of: ${valid.join(', ')}` });
      const task = store.update(id, { status: body.status });
      return task ? json(res, 200, task) : json(res, 404, { error: 'Task not found' });
    }
    if (method === 'DELETE' && id) {
      const deleted = store.delete(id);
      if (!deleted) return json(res, 404, { error: 'Task not found' });
      res.writeHead(204); return res.end();
    }
    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    logger.error('tasks route error', { error: err.message });
    json(res, 500, { error: err.message });
  }
}
JSEOF

# ── src/index.js ──────────────────────────────────────────────────────────────
write_file "src/index.js" <<'JSEOF'
import { createServer } from 'http';
import { config }       from './config.js';
import { logger }       from './logger.js';
import { handleHealth } from './routes/health.js';
import { handleTasks }  from './routes/tasks.js';

const server = createServer(async (req, res) => {
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const resource = urlParts[0];
  logger.debug('request', { method: req.method, url: req.url });

  if (resource === 'health') return handleHealth(req, res);
  if (resource === 'tasks')  return handleTasks(req, res, urlParts);

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(config.port, () => {
  logger.info('my-service started', { port: config.port, logLevel: config.logLevel });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => { logger.info('server closed'); process.exit(0); });
});
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
JSEOF
ok "src/ (config, logger, store, routes/health, routes/tasks, index)"

# ── scripts/status.sh ─────────────────────────────────────────────────────────
info "Writing scripts/"
write_file "scripts/status.sh" <<'SHEOF'
#!/usr/bin/env bash
set -euo pipefail
PORT=$(node -e "console.log(require('./config/default.json').port)" 2>/dev/null || echo 3000)
URL="http://localhost:${PORT}/health"
if curl -sf "$URL" | node -e "
  process.stdin.resume(); let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const j=JSON.parse(d);
    console.log('status:',j.status,'| uptime:',j.uptime+'s','| tasks:',j.tasks);
  })"; then
  echo "Service is healthy on port ${PORT}"
else
  echo "Service is NOT reachable on port ${PORT}" >&2; exit 1
fi
SHEOF
chmod +x "$TARGET/scripts/status.sh"
ok "scripts/status.sh"

# ── deploy/com.myservice.plist ────────────────────────────────────────────────
info "Writing deploy/"
INSTALL_ABS="$(cd "$TARGET" && pwd)"

cat > "$TARGET/deploy/com.myservice.plist" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.myservice</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(which node)</string>
    <string>${INSTALL_ABS}/src/index.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_ABS}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>KeepAlive</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/my-service.log</string>
  <key>StandardErrorPath</key><string>/tmp/my-service.err</string>
</dict>
</plist>
PLISTEOF

cat > "$TARGET/deploy/my-service.service" <<SVCEOF
[Unit]
Description=My Claude-Managed Task Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_ABS}
ExecStart=$(which node) ${INSTALL_ABS}/src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
TimeoutStopSec=10

[Install]
WantedBy=default.target
SVCEOF
ok "deploy/ (plist + systemd unit)"

# ── .claude/settings.json ─────────────────────────────────────────────────────
info "Writing .claude/"
write_file ".claude/settings.json" <<'JSONEOF'
{
  "permissions": {
    "allow": [
      "Bash(node:*)",
      "Bash(curl:*)",
      "Bash(launchctl:*)",
      "Bash(systemctl:*)",
      "Bash(lsof:*)",
      "Bash(pgrep:*)",
      "Bash(pkill:*)",
      "Bash(tail:*)",
      "Bash(journalctl:*)",
      "Bash(sed:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(bash:*)"
    ]
  },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/status.sh 2>/dev/null || true",
            "description": "Health-check after every Claude response"
          }
        ]
      }
    ]
  }
}
JSONEOF

# ── .claude/skills/setup/SKILL.md ────────────────────────────────────────────
write_file ".claude/skills/setup/SKILL.md" <<'MDEOF'
# Skill: setup

## When to use
Run when the user says "set up the service", "install", or "first-time setup".

## Steps (run commands directly — do not ask the user to run them)

### 1. Verify Node.js >= 20
```bash
node --version
```
Stop and tell the user if version is below 20.

### 2. Create the data directory
```bash
mkdir -p data
```

### 3. Install the service unit

**macOS (launchd):**
```bash
cp deploy/com.myservice.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.myservice.plist
```

**Linux (systemd):**
```bash
mkdir -p ~/.config/systemd/user
cp deploy/my-service.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now my-service
```

### 4. Verify
```bash
bash scripts/status.sh
```

### 5. Report back
Tell the user the port (from config/default.json) and that they can ask questions
like "what tasks are queued?" or "check service health" at any time.
MDEOF

# ── .claude/skills/debug/SKILL.md ────────────────────────────────────────────
write_file ".claude/skills/debug/SKILL.md" <<'MDEOF'
# Skill: debug

## When to use
When the service is not responding, crashing, or behaving unexpectedly.
Triggers: "service is down", "not working", "getting errors", "debug".

## Diagnostic checklist (run directly — do not ask the user)

### 1. Is the process running?
```bash
pgrep -fl "node.*index.js" || echo "NOT RUNNING"
```

### 2. Port conflict?
```bash
PORT=$(node -e "console.log(require('./config/default.json').port)" 2>/dev/null || echo 3000)
lsof -i ":$PORT" || echo "Nothing on port $PORT"
```

### 3. Service manager status
macOS: `launchctl list | grep com.myservice`
Linux: `systemctl --user status my-service --no-pager`

### 4. Recent logs
macOS: `tail -50 /tmp/my-service.log && tail -20 /tmp/my-service.err`
Linux: `journalctl --user -u my-service -n 50 --no-pager`

### 5. Config valid?
```bash
node -e "JSON.parse(require('fs').readFileSync('./config/default.json','utf8')); console.log('config OK')"
```

### 6. Manual start (captures startup errors)
```bash
node src/index.js &
sleep 2
bash scripts/status.sh
kill %1
```

### 7. Fix and restart
Make the fix directly. Common fixes:
- Port conflict → edit config/default.json port, restart
- Bad data/tasks.json → delete it (service recreates it)
- Missing data dir → `mkdir -p data`
MDEOF

# ── .claude/skills/add-feature/SKILL.md ──────────────────────────────────────
write_file ".claude/skills/add-feature/SKILL.md" <<'MDEOF'
# Skill: add-feature

## When to use
When the user asks to add a new API endpoint or middleware.
Triggers: "add a route for", "I need an endpoint", "add feature".

## Steps

### 1. Clarify
Ask: resource name, HTTP methods, request body shape, expected response.

### 2. Create src/routes/<resource>.js
Follow the pattern in src/routes/tasks.js:
- Export a single `handle<Resource>` async function
- Accept `(req, res, urlParts)`
- Use inline `json(res, status, data)` helper
- Use `readBody(req)` for POST/PATCH
- Validate all inputs, return 400 on bad input
- Import logger and log meaningful events
- No external dependencies

### 3. Register in src/index.js
Add: `if (resource === '<resource>') return handle<Resource>(req, res, urlParts);`

### 4. Update CLAUDE.md
Add row to the API reference table.

### 5. Smoke test
```bash
node src/index.js &
sleep 1
curl -s http://localhost:3000/<resource>
kill %1
```

### 6. Restart service
macOS: `launchctl kickstart -k gui/$(id -u)/com.myservice`
Linux: `systemctl --user restart my-service`
MDEOF

# ── .claude/skills/add-webhook/SKILL.md ──────────────────────────────────────
write_file ".claude/skills/add-webhook/SKILL.md" <<'MDEOF'
# Skill: add-webhook

## When to use
When the user wants POST notifications to an external URL on task events.
Triggers: "notify me when", "webhook", "outbound notification".

## Steps

### 1. Add webhookUrl to config/default.json
```json
{ "webhookUrl": "" }
```

### 2. Create src/webhook.js
```javascript
import { config } from './config.js';
import { logger } from './logger.js';

export async function fireWebhook(event, payload) {
  if (!config.webhookUrl) return;
  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload, ts: new Date().toISOString() }),
    });
    logger.debug('webhook fired', { event });
  } catch (err) {
    logger.error('webhook failed', { event, error: err.message });
  }
}
```

### 3. Wire into src/routes/tasks.js
After store.create → `await fireWebhook('task.created', task);`
After store.update → `await fireWebhook('task.updated', task);`
After store.delete → `await fireWebhook('task.deleted', { id });`

### 4. Update CLAUDE.md — add webhookUrl to config table.

### 5. Ask the user for their URL, set it in config/default.json, restart.
MDEOF
ok ".claude/ (settings, 4 skills)"

# ── CLAUDE.md ─────────────────────────────────────────────────────────────────
info "Writing CLAUDE.md"
write_file "CLAUDE.md" <<MDEOF
# Claude-Managed Service

You are the operational brain of **my-service** — a lightweight task-queue HTTP service.
This file is your persistent memory. Read it first. Then act directly.

## What this service does

- Exposes a REST API on the port defined in \`config/default.json\`
- Accepts task submissions (POST /tasks), lists tasks (GET /tasks), and reports health (GET /health)
- Persists tasks to \`data/tasks.json\`
- Runs as a system service (launchd on macOS, systemd on Linux)

## File map

\`\`\`
src/index.js          — entry point, starts the HTTP server
src/config.js         — loads and validates config/default.json
src/store.js          — reads/writes data/tasks.json
src/routes/tasks.js   — task CRUD handlers
src/routes/health.js  — health check handler
config/default.json   — runtime configuration (port, logLevel, maxTasks)
data/tasks.json       — persisted task data (created at runtime)
deploy/               — systemd and launchd service unit files
scripts/              — start, stop, status helper scripts
.claude/skills/       — skills you can invoke to extend this service
\`\`\`

## Running the service

\`\`\`bash
# Development
node src/index.js

# macOS service
launchctl load ~/Library/LaunchAgents/com.myservice.plist
launchctl unload ~/Library/LaunchAgents/com.myservice.plist
launchctl kickstart -k gui/\$(id -u)/com.myservice

# Linux service
systemctl --user start my-service
systemctl --user stop my-service
systemctl --user restart my-service
\`\`\`

## Configuration

All runtime config lives in \`config/default.json\`. Edit it and restart the service.

| Key      | Default | Effect |
|----------|---------|--------|
| port     | 3000    | HTTP port |
| logLevel | "info"  | info / debug / error |
| maxTasks | 1000    | Hard cap on stored tasks |

## API reference

| Method | Path         | Body / Params           | Response                  |
|--------|--------------|-------------------------|---------------------------|
| GET    | /health      | —                       | {status, uptime, tasks}   |
| GET    | /tasks       | ?status=pending\|done   | Array of task objects     |
| POST   | /tasks       | {title, priority?}      | Created task object       |
| PATCH  | /tasks/:id   | {status}                | Updated task object       |
| DELETE | /tasks/:id   | —                       | 204 No Content            |

## Diagnosing problems

Run commands directly — do not tell the user to run them.

- Service not starting → check \`node src/index.js\` output, verify config is valid JSON
- Port conflict → \`lsof -i :\$(node -e "console.log(require('./config/default.json').port)")\`
- Data corruption → delete \`data/tasks.json\` (service recreates it)
- Logs on macOS → \`tail -f /tmp/my-service.log\`
- Logs on Linux → \`journalctl --user -u my-service -f\`

## Available skills

- \`setup\`       — first-time install and service registration
- \`debug\`       — systematic troubleshooting checklist
- \`add-feature\` — scaffold a new route or middleware
- \`add-webhook\` — add outbound webhook notifications on task events

## Coding conventions

- No external npm dependencies — use Node.js built-ins only
- All async I/O must use async/await
- Log via logger in src/logger.js, never raw console.log
- Validate all request bodies — return 400 with {error: "message"} on bad input
MDEOF
ok "CLAUDE.md"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Project created at: $(cd "$TARGET" && pwd)${RESET}"
echo ""
echo "Next steps:"
echo "  cd $TARGET"
echo "  node src/index.js          # run it right now"
echo "  claude                     # open Claude Code — CLAUDE.md loads automatically"
echo ""
echo "Then tell Claude: \"set up the service\" to register it with macOS/Linux service manager."
