# Skill: add-telegram

## When to use

Run when the user asks to:
- "add Telegram to the service"
- "enable Telegram messaging"
- "set up Telegram bot"
- "integrate Telegram"

## What this skill does

- Explains Telegram polling-based integration
- Guides user through @BotFather bot creation
- Guides user to get their chat ID via @userinfobot
- Updates .env with TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS
- Updates CLAUDE.md with Telegram setup instructions
- Provides step-by-step command testing in Telegram

## Prerequisites

- Telegram app installed on phone or desktop
- Access to @BotFather (Telegram's official bot)
- Access to @userinfobot (to get your chat ID)
- Node.js 16+ (already have this)

## How Telegram Integration Works

The service runs a **polling bot** that:
1. Calls Telegram API every ~30 seconds to check for new messages
2. Receives user commands (like /status, /add, /tasks)
3. Parses the command text
4. Executes the handler and sends response back
5. User sees the bot's reply in their Telegram chat

Unlike webhook-based integrations, polling is:
- **Simpler** — no need to expose a public webhook URL
- **Localhost-friendly** — works locally without ngrok or tunneling
- **Stateless** — no connection state to manage

## Steps (run commands directly — do not ask the user to run them)

### 1. Create a Bot via @BotFather

1. Open Telegram app
2. Search for **@BotFather** (Telegram's official bot manager)
3. Send `/newbot`
4. BotFather asks for a bot name (e.g., "my-service-bot")
5. BotFather asks for a username (e.g., "my_service_bot_123")
6. BotFather responds with your **bot token**:
   ```
   Use this token to access the HTTP API:
   123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
   ```
7. Copy and save this token

### 2. Get Your Chat ID from @userinfobot

1. Search for **@userinfobot** in Telegram
2. Send `/start`
3. @userinfobot responds with your user ID:
   ```
   Your user id is: 123456789
   ```
4. Copy and save this ID

### 3. Configure .env

Copy `.env.example` to `.env` if you haven't already:
```bash
cp .env.example .env
```

Edit `.env` and add:
```bash
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

**Important:** 
- Never commit `.env` to git (it's in `.gitignore`)
- Replace the values with YOUR actual token and chat ID
- No spaces around the `=` sign

### 4. Start the Service

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

### 5. Test Telegram Commands

Open Telegram and send these commands to your bot:

| Command | Expected Response |
|---------|------------------|
| `/status` | Service is OK. Uptime: XXs. Tasks: N. |
| `/tasks` | Lists all tasks (or "No tasks yet") |
| `/tasks pending` | Lists only pending tasks |
| `/add Buy groceries` | Creates a task: "Buy groceries" |
| `/agents` | Lists registered agents (or "No agents") |
| `/help` | Shows all available commands |

### 6. Verify in Dashboard

While the service is running, open:
```
http://localhost:3000/dashboard
```

You should see:
- Task count increasing as you create tasks via Telegram
- Live event feed showing each Telegram command
- Task distribution bar updating in real-time

### 7. Cross-Channel Testing (if WhatsApp is also enabled)

Test that both channels work together:
1. Send Telegram: `/add Task from Telegram`
2. Send WhatsApp: `add Task from WhatsApp`
3. On dashboard, verify both tasks appear
4. In Telegram, `/tasks` should show both Telegram and WhatsApp tasks
5. In WhatsApp, `tasks` should show both

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot doesn't respond | Check `TELEGRAM_BOT_TOKEN` is correct (no extra spaces or line breaks) |
| "Unauthorized" error | Verify `TELEGRAM_ALLOWED_CHAT_IDS` matches your actual chat ID from @userinfobot |
| Service starts but bot doesn't poll | Check logs: `grep -i telegram /tmp/my-service.log` |
| Commands are parsed strangely | Bot is strict about exact commands — `/tasks pending` works, but `/tasks  pending` (2+ spaces) won't |
| No responses in Telegram | Restart service after updating `.env` — bot connects on startup |

## Verification

✓ Bot token obtained from @BotFather
✓ Chat ID obtained from @userinfobot
✓ .env has TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS
✓ Service started: `node src/index.js`
✓ Bot responds to `/status`
✓ `/tasks` lists existing tasks
✓ `/add` creates a new task
✓ Task appears in dashboard
✓ Both Telegram and WhatsApp work together (if enabled)

## File Locations

- `.env` — Your secrets (never commit)
- `.env.example` — Template with all env vars
- `src/channels/telegram.js` — Telegram bot implementation
- `TESTING-QUICK.md` — Quick 5-minute setup reference
- `TESTING-MANUAL.md` — Full manual testing guide
