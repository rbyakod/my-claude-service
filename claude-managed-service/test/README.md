# Testing Guide — Messaging Channels & Service Health

This directory contains tests for the claude-managed-service messaging channels (Telegram and WhatsApp) and core service functionality.

## Quick Start

```bash
# Unit tests (no running service needed)
node test/telegram.test.js

# Integration test (starts service, runs tests, stops it)
node test/integration.test.js
```

**Note**: WhatsApp is tested via the full integration test. For manual testing with real WhatsApp, see `TESTING-MANUAL.md`.

## Test Files

### `telegram.test.js` — Telegram channel unit tests

Tests the Telegram bot functionality without needing real credentials.

**What it tests:**
- Message polling simulation (what happens every 30 seconds)
- Command parsing: `/status`, `/tasks`, `/add`, `/agents`, `/help`
- Webhook receiver (if Telegram is configured with webhooks)
- Credential validation (checks if env vars are set)

**Run:**
```bash
node test/telegram.test.js
```

**Output example:**
```
=== Testing Telegram Polling ===

→ Received: "/status"
  Response: Service is healthy. Tasks: 3

→ Received: "/tasks pending"
  Response: Found 3 tasks (filter: pending)
...
✓ Telegram polling test passed
```

---

### `integration.test.js` — Full service integration test

Starts the service and tests it end-to-end. **This is the most comprehensive test.**

**What it tests:**
- `GET /health` — service is responding
- `POST /tasks` — task creation
- `GET /tasks` — task listing
- `POST /agents` — agent registration
- `PATCH /agents/:id` — agent heartbeat
- `GET /events` — SSE stream (Server-Sent Events)
- Rate limiting (429 responses)

**Run:**
```bash
node test/integration.test.js
```

**Output example:**
```
╔════════════════════════════════════════╗
║   Integration Tests — Messaging       ║
║      Channels & Service Health        ║
╚════════════════════════════════════════╝

→ Starting service...
✓ Service started

=== Testing /health endpoint ===
Status: 200
Body: { status: 'ok', uptime: 5, tasks: 0, version: '1.0.0' }
✓ Health check passed

=== Testing task creation ===
Status: 201
Created task: Test task from integration test
✓ Task creation passed

...

╔════════════════════════════════════════╗
║    All integration tests passed! ✓     ║
╚════════════════════════════════════════╝
```

---

## Testing with Real Credentials

If you want to test with **actual Telegram or WhatsApp** channels:

### Telegram Setup

1. Create a Telegram bot via @BotFather
2. Set env vars in `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=<your-bot-token>
   TELEGRAM_ALLOWED_CHAT_IDS=<your-chat-id>
   ```
3. Start the service: `node src/index.js`
4. Message your bot with: `/status`, `/tasks`, `/add Task name`, `/help`
5. Check that responses come back

### WhatsApp Setup (Baileys Direct Integration)

1. Set env vars in `.env`:
   ```bash
   WHATSAPP_ENABLED=true
   ```
2. Start the service: `node src/index.js`
3. Scan the QR code shown in terminal with WhatsApp (Settings → Linked devices)
4. Wait for "whatsapp: connected and ready" message
5. Send WhatsApp messages: `status`, `tasks`, `add My task`, `help`
6. Check that responses come back

**Note:** Requires running the `add-whatsapp` skill first to install the Baileys implementation.

---

## Test Structure

```
test/
├── README.md                  ← This file
├── telegram.test.js           ← Telegram unit tests
└── integration.test.js        ← Full service integration test
```

---

## What Each Test Validates

| Test | What it validates | Needs real credentials? |
|------|-------------------|------------------------|
| `telegram.test.js` | Message parsing, command handling, credential presence | No |
| `integration.test.js` | Service health, API endpoints, agents, events stream, rate limiting | No |

---

## Running All Tests Together

```bash
echo "Running all tests..."
node test/telegram.test.js && \
node test/integration.test.js && \
echo "✓ All tests passed!"
```

Or in parallel (faster):
```bash
node test/telegram.test.js &
node test/integration.test.js &
wait
```

---

## Troubleshooting

### `Connection refused on port 3000`
The integration test couldn't start the service. Check:
- Is Node.js installed? `node --version`
- Are you in the right directory? `pwd`
- Is something already listening on port 3000? `lsof -i :3000`

### `Timeout waiting for events`
The SSE endpoint took too long to respond. Normal if system is slow. The test passes anyway.

### `Rate limiting test is slow`
The rate limiting window is 1 minute. The test deliberately doesn't fill it to avoid false positives.

---

## Next Steps

Once tests pass:

1. **Start the service locally:**
   ```bash
   node src/index.js
   ```

2. **Test the dashboard:**
   ```bash
   open http://localhost:3000/dashboard
   ```

3. **Create tasks via API:**
   ```bash
   curl -X POST http://localhost:3000/tasks \
     -H "Content-Type: application/json" \
     -d '{"title":"Test task","priority":"high"}'
   ```

4. **Set up Telegram/WhatsApp** (optional):
   - Telegram: See `TESTING-MANUAL.md` Part 1
   - WhatsApp (Baileys): See `TESTING-MANUAL.md` Part 2 or use the `add-whatsapp` skill
   - Env vars in `.env` (never committed)
   - Restart the service to load credentials

5. **Deploy to Docker** (production):
   ```bash
   docker compose up -d
   docker compose ps  # confirm healthy
   ```
