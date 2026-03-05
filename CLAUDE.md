# Claude-Managed Service

You are the operational brain of **my-service** — a lightweight task-queue HTTP service.
This file is your persistent memory. Read it first. Then act directly.

## What this service does

- Exposes a REST API on the port defined in `config/default.json`
- Accepts task submissions (POST /tasks), lists tasks (GET /tasks), and reports health (GET /health)
- Persists tasks to `data/tasks.json`
- Runs as a system service (launchd on macOS, systemd on Linux)

## File map

```
src/index.js          — entry point, starts the HTTP server
src/config.js         — loads and validates config/default.json
src/store.js          — reads/writes data/tasks.json
src/routes/tasks.js   — task CRUD handlers
src/routes/health.js  — health check handler
config/default.json   — runtime configuration (port, log level, max tasks)
data/tasks.json       — persisted task data (created at runtime)
deploy/               — systemd and launchd service unit files
scripts/              — start, stop, status helper scripts
.claude/skills/       — skills you can invoke to extend this service
```

## Running the service

```bash
# Development (with live output)
node src/index.js

# macOS service
launchctl load ~/Library/LaunchAgents/com.myservice.plist
launchctl unload ~/Library/LaunchAgents/com.myservice.plist
launchctl kickstart -k gui/$(id -u)/com.myservice

# Linux service
systemctl --user start my-service
systemctl --user stop my-service
systemctl --user restart my-service
systemctl --user status my-service
```

## Configuration

All runtime config lives in `config/default.json`. Edit it and restart the service.
Never hardcode values in source files — always reference config.

| Key        | Default | Effect                        |
|------------|---------|-------------------------------|
| port       | 3000    | HTTP port the service listens on |
| logLevel   | "info"  | Logging verbosity (info/debug/error) |
| maxTasks   | 1000    | Hard cap on stored tasks      |

## API reference

| Method | Path          | Body / Params              | Response                  |
|--------|---------------|----------------------------|---------------------------|
| GET    | /health       | —                          | `{status, uptime, tasks}` |
| GET    | /tasks        | `?status=pending\|done`    | Array of task objects     |
| POST   | /tasks        | `{title, priority?}`       | Created task object       |
| PATCH  | /tasks/:id    | `{status}`                 | Updated task object       |
| DELETE | /tasks/:id    | —                          | 204 No Content            |

## Diagnosing problems

Run commands directly — do not tell the user to run them.

- Service not starting → check `node src/index.js` for syntax errors, verify config is valid JSON
- Port conflict → `lsof -i :$(node -e "console.log(require('./config/default.json').port)")`
- Data corruption → inspect `data/tasks.json`, delete it to reset (service recreates it)
- Logs on macOS → `tail -f /tmp/my-service.log`
- Logs on Linux → `journalctl --user -u my-service -f`

## How to add features

Use the skills in `.claude/skills/`. Each skill is a markdown file that tells you exactly
what changes to make. Invoke them by saying e.g. "use the add-webhook skill".

Available skills:
- `setup`       — first-time install and service registration
- `debug`       — systematic troubleshooting checklist
- `add-feature` — scaffold a new route or middleware
- `add-webhook` — add outbound webhook notifications on task events

## Coding conventions

- No external npm dependencies unless absolutely necessary — use Node.js built-ins
- All async I/O must use async/await, never callbacks
- Log with the logger in src/logger.js, never raw console.log
- Validate all request bodies — return 400 with `{error: "message"}` on bad input
- Keep each route file focused on one resource
