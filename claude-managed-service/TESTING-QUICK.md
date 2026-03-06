# Quick Testing Reference

## 30-Minute Setup

### Telegram (5 min)

```bash
# 1. Get bot token from @BotFather (copy token)
# 2. Get chat ID from @userinfobot (copy ID)
# 3. Create .env from example
cp .env.example .env

# 4. Edit .env with your values
TELEGRAM_BOT_TOKEN=your-token-here
TELEGRAM_ALLOWED_CHAT_IDS=your-chat-id-here

# 5. Start service
node src/index.js

# 6. In Telegram, send to your bot:
/status
/tasks
/add My first task
/help
```

### WhatsApp (Baileys, 2 min)

```bash
# 1. Edit .env
WHATSAPP_ENABLED=true

# 2. Start service
node src/index.js

# 3. You will see: "whatsapp: scan this QR..."

# 4. Open WhatsApp on your phone → Settings → Linked devices → Link a device

# 5. Scan the QR code shown in your terminal

# 6. Wait 3-5 seconds for connection: "whatsapp: connected and ready"

# 7. Send WhatsApp messages:
status
tasks
add My first task
help
```

---

## Test Commands

### Telegram Commands
```
/status              → Service health
/tasks               → List all tasks
/tasks pending       → Filter by status
/add <title>         → Create task
/agents              → List agents
/help                → Show commands
```

### WhatsApp Commands
```
status               → Service health
tasks                → List all tasks
add <title>          → Create task
agents               → List agents
help                 → Show commands
```

---

## Verification Checklist

```
Telegram:
  ✓ Bot token obtained from @BotFather
  ✓ Chat ID from @userinfobot
  ✓ .env has TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS
  ✓ Service started: node src/index.js
  ✓ Bot responds to /status
  ✓ /tasks lists any existing tasks
  ✓ /add creates a new task
  ✓ Telegram task appears in dashboard

WhatsApp (Baileys):
  ✓ .env has WHATSAPP_ENABLED=true
  ✓ Service shows "scan this QR..."
  ✓ QR scanned via WhatsApp app → Settings → Linked devices
  ✓ Service logs "whatsapp: connected and ready"
  ✓ WhatsApp responds to "status"
  ✓ "tasks" command lists tasks
  ✓ "add" command creates task
  ✓ WhatsApp task appears in dashboard

Both:
  ✓ Task created via API appears in both channels
  ✓ Dashboard shows both channels' tasks
  ✓ Live event feed updates in real-time
  ✓ /add in Telegram + "add" in WhatsApp both work simultaneously
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Telegram bot not responding | Check `TELEGRAM_BOT_TOKEN` is correct (no spaces) |
| "Unauthorized" in Telegram | Verify `TELEGRAM_ALLOWED_CHAT_IDS` matches your chat ID from @userinfobot |
| No WhatsApp QR code appears | Check `WHATSAPP_ENABLED=true`, restart service |
| WhatsApp QR scans but doesn't connect | Try on a different phone or WhatsApp account |
| .env not being read | Make sure file is named `.env` (not `.env.txt` or `.env.example`) |
| Service crashes on startup | Check logs: `node src/index.js` (errors will show) |
| Dashboard not updating | Refresh page, check browser console for errors |
| WhatsApp connection drops | Normal — service auto-reconnects in ~3s |

---

## File Locations

```
.env                           ← Your secrets (never commit)
.env.example                   ← Template (safe to commit)
src/channels/telegram.js       ← Telegram implementation
src/channels/whatsapp-baileys.js  ← WhatsApp implementation
TESTING-MANUAL.md              ← Full testing guide
TESTING-QUICK.md               ← Quick reference (this file)
test/                          ← Unit & integration tests
data/whatsapp-sessions/        ← WhatsApp session storage (don't commit)
```

---

## Diagrams

### Telegram Flow
```
Your Telegram Bot
       ↓
[Telegram API polls your bot token every ~30s]
       ↓
Service src/channels/telegram.js
       ↓
Parse /command
       ↓
Call appropriate handler (status, tasks, add, agents, help)
       ↓
Send response back to Telegram
       ↓
Message appears in chat
```

### WhatsApp Flow (Baileys)
```
WhatsApp Phone App
       ↓
Scans QR Code
       ↓
Baileys (Node.js WebSocket)
       ↓
Direct WebSocket to WhatsApp servers
       ↓
Session stored in data/whatsapp-sessions/
       ↓
Parse message
       ↓
Call handler
       ↓
Send response back
       ↓
Message appears in WhatsApp
```

---

## One-Liner Tests

### Verify Telegram Setup
```bash
# Check that service is listening
curl -s http://localhost:3000/health | jq .status

# List current tasks (what Telegram /tasks will show)
curl -s http://localhost:3000/tasks | jq '.[].title'

# Create a task (simulates /add from Telegram)
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test from curl"}'
```

### Verify WhatsApp Setup
```bash
# Check service is healthy
curl -s http://localhost:3000/health | jq .status

# Check WhatsApp connection
grep "whatsapp: connected" /tmp/my-service.log
```

---

## Dashboard Testing

While service is running:
1. Open http://localhost:3000/dashboard
2. Send Telegram command: `/add Test task`
3. Watch dashboard update in real-time
4. Send WhatsApp message: `add Another task`
5. Watch both tasks appear together
6. Check "Live event feed" shows both task creations

---

## Stress Test (Optional)

Once basic testing works:

```bash
# Rapid Telegram commands
/add Task 1
/add Task 2
/add Task 3
/tasks
/add Task 4

# Rapid WhatsApp messages (in quick succession)
add Task 5
add Task 6
add Task 7

# Concurrent API calls (from your terminal)
for i in {1..10}; do
  curl -X POST http://localhost:3000/tasks \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"API Task $i\"}" &
done
wait

# Dashboard should show all 14+ tasks without errors
# Live event feed should show all creation events
```

---

## Keeping It Running

### Development
```bash
node src/index.js               # Terminal 1: Service
# Terminal 2: Monitor dashboard
open http://localhost:3000/dashboard
```

### Stop Everything
```
Ctrl+C  in service terminal
```

---

## Setup Methods

### Using the Skill (Recommended)
```bash
claude
# Tell Claude: "add WhatsApp integration" or "use the add-whatsapp skill"
```

### Manual Setup
1. Set `WHATSAPP_ENABLED=true` in `.env`
2. Run service: `node src/index.js`
3. Scan QR code shown in terminal

---

**For full details, see `TESTING-MANUAL.md`**
