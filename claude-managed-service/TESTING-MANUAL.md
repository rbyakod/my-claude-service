# Manual Testing with Real Telegram & WhatsApp

This guide walks you through setting up and testing the Telegram bot and WhatsApp (Baileys) messaging channels.

---

## Part 1: Telegram Bot Testing

### Step 1 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. BotFather asks for a bot name. Enter something like: `my-service-bot`
4. BotFather asks for a username. Enter something like: `my_service_bot_<numbers>`
5. BotFather responds with your bot token:
   ```
   Use this token to access the HTTP API:
   123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
   ```
6. **Copy the token** (you'll need it in step 3)

### Step 2 — Get Your Chat ID

1. Open Telegram and search for **@userinfobot**
2. Send `/start`
3. @userinfobot responds with your user ID. It looks like: `Your user id is: 123456789`
4. **Copy your chat ID** (you'll need it in step 3)

### Step 3 — Configure .env

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and fill in Telegram:
```bash
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

**Important:** Save the file and **NEVER commit it** (it's in `.gitignore`).

### Step 4 — Start the Service

```bash
node src/index.js
```

You should see:
```
my-service started {
  port: 3000,
  logLevel: 'info',
  dashboard: 'http://localhost:3000/dashboard',
  authRequired: false
}
```

### Step 5 — Test Commands in Telegram

Open Telegram and send messages to your bot. You can send:

| Command | Expected Response |
|---------|-------------------|
| `/status` | Service is OK. Uptime: XXs. Tasks: N. |
| `/tasks` | Lists all tasks (or "No tasks yet") |
| `/tasks pending` | Lists only pending tasks |
| `/add Buy groceries` | Creates a task with title "Buy groceries" |
| `/agents` | Lists registered agents (or "No agents") |
| `/help` | Shows available commands |

**Example conversation:**

```
You: /status
Bot: Service is OK. Uptime: 45s. Tasks: 0.

You: /add First task
Bot: ✓ Created task #1: "First task"

You: /add Second task
Bot: ✓ Created task #2: "Second task"

You: /tasks
Bot: Pending (2):
1. First task
2. Second task

You: /agents
Bot: No agents registered.
```

### Step 6 — Verify in Dashboard

While the bot is running, open the dashboard:
```bash
open http://localhost:3000/dashboard
```

You should see:
- Task count increasing as you create tasks
- Live event feed showing each `/add` command as a task creation
- Task distribution bar updating

### Step 7 — Create a Task via API, See it in Telegram

In another terminal:
```bash
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Task from curl","priority":"high"}'
```

Now in Telegram, send `/tasks` — you should see the new task listed.

### Troubleshooting Telegram

| Problem | Solution |
|---------|----------|
| Bot doesn't respond | Check that `TELEGRAM_BOT_TOKEN` is correct (no spaces) |
| "Unauthorized" error | Verify `TELEGRAM_ALLOWED_CHAT_IDS` matches your actual chat ID |
| Service starts but bot doesn't poll | Check logs: `grep -i telegram /tmp/my-service.log` |
| Commands are parsed strangely | Bot responds to exact commands — `/tasks pending` works, `/tasks  pending` (2 spaces) may not |

---

## Part 2: WhatsApp Testing (Baileys Direct Integration)

WhatsApp uses Baileys for direct multi-device API connection. No Twilio account needed. Just a QR code scan.

### Step 1 — Enable WhatsApp in .env

Edit `.env` and set:
```bash
WHATSAPP_ENABLED=true
```

### Step 2 — Start the Service

```bash
node src/index.js
```

Watch for this in the output:
```
whatsapp: scan this QR with your phone camera...
```

A QR code will appear in your terminal.

### Step 3 — Scan QR Code with WhatsApp

1. Open **WhatsApp on your phone**
2. Go to **Settings → Linked devices → Link a device**
3. **Point your phone camera at the QR code** displayed in the terminal
4. Wait 3-5 seconds for the QR to scan
5. WhatsApp will authenticate

### Step 4 — Confirm Connection

Your terminal should now show:
```
whatsapp: connected and ready
```

Session data is saved to `data/whatsapp-sessions/`. On next service restart, it auto-connects without needing a new QR scan.

### Step 5 — Test Commands in WhatsApp

Send these messages to **your own WhatsApp account** (or create a test group and add the bot):

| Message | Expected Response |
|---------|-------------------|
| `status` | Service is OK. Uptime: XXs. Tasks: N. |
| `tasks` | Lists all tasks |
| `add Buy milk` | Creates task "Buy milk" |
| `agents` | Lists agents |
| `help` | Shows commands |

**Example conversation:**

```
You: status
Bot: Status: ok
Uptime: 120s
Tasks: 2.

You: add Pick up package
Bot: ✓ Created: "Pick up package"

You: tasks
Bot: All tasks (3):
1. First task
2. Second task
3. Pick up package

You: add Call dentist
Bot: ✓ Created: "Call dentist"

You: help
Bot: Available commands:
- status: show service health
- tasks: list all tasks
- add <title>: create a task
- agents: list agents
- help: show this message
```

### Step 6 — Verify in Dashboard

Open http://localhost:3000/dashboard and confirm:
- Tasks appear as you send `add` commands
- Live event feed shows each task creation
- Task count updates in real-time

### Step 7 — Test Both Channels Together

1. Send Telegram command: `/add Task from Telegram`
2. Check dashboard — task appears instantly
3. Send WhatsApp message: `add Task from WhatsApp`
4. Both tasks appear together on dashboard
5. Verify both channels see each other's tasks:
   - Telegram: `/tasks` — see WhatsApp task
   - WhatsApp: `tasks` — see Telegram task

### Troubleshooting WhatsApp

| Problem | Solution |
|---------|----------|
| No QR code appears | Check `WHATSAPP_ENABLED=true`, restart service |
| QR scans but connection fails | Your WhatsApp account might be restricted. Try a different phone or account. |
| Service loses connection | Normal — it auto-reconnects. Check logs: `tail -f /tmp/my-service.log \| grep whatsapp` |
| "WARN whatsapp: disconnected" | This is normal during reconnection. Connection re-establishes in ~3s. |
| Session files keep growing | Normal. Clean with: `rm -rf data/whatsapp-sessions/` to reset (will need new QR scan). |
| Bot doesn't respond to messages | Verify WhatsApp connection shows "connected and ready", check service logs |

---

## Testing Both Channels Together

### Test 1 — Create task via Telegram, see it in WhatsApp

```
Telegram: /add Task from Telegram
Dashboard: Task appears immediately
WhatsApp: Send "tasks" → see the new task
```

### Test 2 — Create task via WhatsApp, see it in Telegram

```
WhatsApp: add Task from WhatsApp
Dashboard: Task appears immediately
Telegram: /tasks → see the new task
```

### Test 3 — Register an agent, see it in both channels

```bash
# In another terminal, register an agent
curl -X POST http://localhost:3000/agents \
  -H 'Content-Type: application/json' \
  -d '{"id":"worker-1","name":"Data Processor","capability":"processing"}'
```

Then:
- Telegram: `/agents` → see "Data Processor"
- WhatsApp: `agents` → see "Data Processor"

### Test 4 — Test dashboard with both channels active

```
open http://localhost:3000/dashboard
```

While dashboard is open:
1. Send Telegram message: `/add Dashboard test`
2. Check that the task appears on dashboard instantly (via SSE)
3. Send WhatsApp message: `add Another dashboard test`
4. Check that both channels' tasks appear in the live event feed

---

## Stress Testing (Optional)

Once basic testing works, try:

1. **Rapid commands:**
   ```
   Telegram: /add Task 1, /add Task 2, /add Task 3 (all in quick succession)
   WhatsApp: add Task 4, add Task 5, add Task 6 (rapid fire)
   ```
   All should create without errors.

2. **Long titles:**
   ```
   /add This is a very long task title with lots of words to see how the service handles it
   ```
   Should truncate gracefully (max 300 chars).

3. **Special characters:**
   ```
   /add Task with emoji 🚀
   /add Task with quotes "hello"
   ```
   Should handle these without errors.

4. **Concurrent requests:**
   ```bash
   # In one terminal, keep sending Telegram messages
   # In another terminal, curl the API repeatedly
   # In another terminal, send WhatsApp messages
   # All should be handled without race conditions
   ```

---

## Cleanup

When done testing:

1. Stop the service: `Ctrl+C`
2. Keep `.env` — it's in `.gitignore` and won't be committed
3. WhatsApp session: `data/whatsapp-sessions/` persists across restarts (no need to re-scan QR)
4. Reset WhatsApp (optional): `rm -rf data/whatsapp-sessions/` then restart for new QR scan

---

## Checklist — Manual Testing Complete ✓

- [ ] Telegram bot token obtained from @BotFather
- [ ] Chat ID obtained from @userinfobot
- [ ] .env configured with Telegram credentials
- [ ] Service started and responding to Telegram commands
- [ ] `WHATSAPP_ENABLED=true` in .env
- [ ] Service started and showing WhatsApp QR code
- [ ] QR code scanned successfully via WhatsApp app
- [ ] Service logs show "whatsapp: connected and ready"
- [ ] Service responding to WhatsApp commands
- [ ] Dashboard shows tasks from both channels
- [ ] Tasks created via API appear in both channels
- [ ] Both channels handle concurrent requests without errors

---

## Next Steps

Once manual testing is complete and both channels are working:

1. **Deploy to Docker (production-ready):**
   ```bash
   docker compose up -d
   docker compose logs -f my-service
   ```

2. **Use with Claude Code:**
   ```bash
   claude
   # Tell Claude: "open the dashboard", "check agents", "what tasks are pending?"
   ```

3. **Add more channels:**
   - Follow the pattern in `src/channels/telegram.js` and `.claude/skills/add-whatsapp/SKILL.md`
   - Use the `add-skill` to scaffold new channel integrations
