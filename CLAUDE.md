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
Dockerfile            — secure multi-stage production image
docker-compose.yml    — hardened compose config (read-only, non-root, capped)
.dockerignore         — excludes .claude/, data/, secrets from image
.mcp.json             — MCP server definitions (filesystem, fetch, sqlite)
.claude/skills/       — skills you can invoke to extend this service
```

## Running the service

```bash
# Development
node src/index.js

# macOS service
launchctl load ~/Library/LaunchAgents/com.myservice.plist
launchctl unload ~/Library/LaunchAgents/com.myservice.plist
launchctl kickstart -k gui/$(id -u)/com.myservice

# Linux service
systemctl --user start my-service
systemctl --user stop my-service
systemctl --user restart my-service

# Docker (recommended for production)
docker compose up -d
docker compose down
docker compose logs -f my-service
```

## Docker

The service ships with a secure Dockerfile and docker-compose.yml.

Key security properties:
- Runs as non-root user (uid 1000)
- Read-only container filesystem (`--read-only`)
- Only `data/` (volume) and `/tmp` (tmpfs) are writable
- All Linux capabilities dropped (`cap_drop: ALL`)
- Port bound to `127.0.0.1` — not reachable from outside the host
- Memory: 256 MB, CPU: 0.5 cores

Config is bind-mounted read-only, so you can change `config/default.json`
on the host and restart the container — no image rebuild needed.

Use the `docker` skill for build, run, log, and troubleshoot commands.

## MCP servers

`.mcp.json` defines MCP servers Claude can use as extra tools.
Claude loads them automatically at session start.

| Server name  | Package                                       | What it gives Claude            |
|--------------|-----------------------------------------------|---------------------------------|
| filesystem   | @modelcontextprotocol/server-filesystem       | Direct read/write on data/ and config/ |
| fetch        | @modelcontextprotocol/server-fetch            | HTTP requests for webhook testing |
| sqlite       | @modelcontextprotocol/server-sqlite           | Query data/tasks.db if you switch to SQLite |

To add a new MCP server, use the `add-mcp` skill.

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
- `docker`      — build, run, inspect, and troubleshoot the Docker container
- `add-skill`   — create a new skill to teach Claude a new capability
- `add-mcp`     — connect Claude to an external service via MCP

## Coding conventions

- No external npm dependencies unless absolutely necessary — use Node.js built-ins
- All async I/O must use async/await, never callbacks
- Log with the logger in src/logger.js, never raw console.log
- Validate all request bodies — return 400 with `{error: "message"}` on bad input
- Keep each route file focused on one resource
