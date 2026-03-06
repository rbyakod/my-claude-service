# Skill: add-whatsapp

## When to use

Run when the user asks to:
- "add WhatsApp to the service"
- "enable WhatsApp messaging"
- "set up WhatsApp integration"
- "use Baileys for WhatsApp"

This skill replaces Twilio with direct WhatsApp integration using the Baileys library (same approach as NanoClaw).

## What this skill does

- Explains the difference between Twilio and Baileys (direct) integration
- Adds Baileys package to package.json
- Creates src/channels/whatsapp-baileys.js with full implementation
- Creates auth session storage setup in data/whatsapp-sessions/
- Updates src/index.js to initialize WhatsApp channel
- Updates CLAUDE.md with new WhatsApp setup instructions
- Provides step-by-step QR code scanning instructions

## Prerequisites

- WhatsApp installed on your mobile phone
- Node.js 17+ (already have this)
- ~30 seconds to scan a QR code

## Steps (run commands directly — do not ask the user to run them)

### 1. Add Baileys to package.json

Open `package.json` and add Baileys to dependencies:

```json
{
  "type": "module",
  "dependencies": {},
  "devDependencies": {
    "@whiskeysockets/baileys": "^6.7.0",
    "pino": "^8.17.2",
    "pino-pretty": "^10.2.3"
  }
}
```

Then install:
```bash
npm install
```

### 2. Create WhatsApp Baileys implementation

Create `src/channels/whatsapp-baileys.js`:

```javascript
/**
 * WhatsApp channel — Baileys direct integration (multi-device API)
 *
 * Unlike Twilio (third-party), this uses Baileys to connect directly to WhatsApp
 * via the official multi-device Web protocol. No external dependencies, no costs.
 *
 * Flow: WhatsApp phone → QR scan → Session stored in data/whatsapp-sessions
 *       → Auto-reconnect on restart → Messages received via EventEmitter
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';
import { store } from '../store.js';
import { emitter } from '../emitter.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const AUTH_DIR = resolve(__dirname, '../..', 'data/whatsapp-sessions');

let sock = null;
let isConnecting = false;

// ── Initialize WhatsApp session directory ──────────────────────────────────
function initAuthDir() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }
}

// ── Connect to WhatsApp ──────────────────────────────────────────────────────
export async function startWhatsApp() {
  // Only start if enabled (via env var)
  if (!process.env.WHATSAPP_ENABLED) {
    return;
  }

  if (isConnecting || sock) {
    return;
  }

  isConnecting = true;
  logger.info('whatsapp: connecting...');

  try {
    initAuthDir();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,  // Show QR in terminal for user to scan
      logger: pino({ level: 'info' }),
      browser: ['my-service', 'Safari', '1.0.0'],  // Appear as linked device
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    // ── Save credentials on update ─────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ── Handle messages ────────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe || !msg.message) continue;

        const sender = msg.key.remoteJid;
        const text = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     '[media]';

        logger.info('whatsapp: received', {
          from: sender,
          text: text.substring(0, 100),
        });

        // Parse command and handle
        await handleWhatsAppCommand(sender, text);

        // Mark as read
        try {
          await sock.readMessages([msg.key]);
        } catch (err) {
          logger.error('whatsapp: mark read failed', { error: err.message });
        }
      }
    });

    // ── Handle connection state ────────────────────────────────────────────
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('whatsapp: scan this QR with your phone camera (or WhatsApp → Settings → Linked devices)');
      }

      if (connection === 'open') {
        logger.info('whatsapp: connected and ready');
        isConnecting = false;
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error?.output?.statusCode) !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          logger.warn('whatsapp: disconnected, will reconnect in 3s');
          setTimeout(() => startWhatsApp(), 3000);
        } else {
          logger.error('whatsapp: logged out');
          isConnecting = false;
        }
      }
    });

    logger.info('whatsapp: initialized');
  } catch (err) {
    logger.error('whatsapp: failed to start', { error: err.message });
    isConnecting = false;
    // Retry after delay
    setTimeout(() => startWhatsApp(), 5000);
  }
}

// ── Stop WhatsApp gracefully ──────────────────────────────────────────────────
export function stopWhatsApp() {
  if (sock) {
    try {
      sock.end();
      sock = null;
      logger.info('whatsapp: stopped');
    } catch (err) {
      logger.error('whatsapp: stop failed', { error: err.message });
    }
  }
}

// ── Handle WhatsApp commands ──────────────────────────────────────────────────
async function handleWhatsAppCommand(sender, text) {
  const cmd = text.trim().toLowerCase();
  let response = '';

  try {
    if (cmd === 'status') {
      const health = { status: 'ok', uptime: Math.floor(process.uptime()), tasks: store.list().length };
      response = `Status: ${health.status}\nUptime: ${health.uptime}s\nTasks: ${health.tasks}`;
    } else if (cmd === 'tasks') {
      const tasks = store.list();
      if (tasks.length === 0) {
        response = 'No tasks yet.';
      } else {
        response = 'Tasks:\n' + tasks.map(t => `• ${t.title} (${t.status})`).join('\n');
      }
    } else if (cmd.startsWith('add ')) {
      const title = cmd.slice(4).trim();
      if (title) {
        const task = store.create(title, 'normal');
        response = `✓ Created: "${task.title}"`;
      } else {
        response = 'Usage: add <task title>';
      }
    } else if (cmd === 'agents') {
      const agents = store.listAgents?.() || [];
      if (agents.length === 0) {
        response = 'No agents registered.';
      } else {
        response = 'Agents:\n' + agents.map(a => `• ${a.name} (${a.status})`).join('\n');
      }
    } else if (cmd === 'help') {
      response = `Commands:\n• status - service health\n• tasks - list tasks\n• add <title> - create task\n• agents - list agents\n• help - show this`;
    } else {
      response = 'Unknown command. Type "help" for available commands.';
    }

    // Send response
    if (sock && response) {
      await sock.sendMessage(sender, { text: response });
      logger.info('whatsapp: sent', { to: sender, length: response.length });
    }
  } catch (err) {
    logger.error('whatsapp: command failed', { error: err.message, command: text });
    try {
      await sock.sendMessage(sender, { text: 'Error processing your message. Please try again.' });
    } catch (e) {
      // ignore
    }
  }
}

// ── Export status for dashboard ────────────────────────────────────────────────
export function getWhatsAppStatus() {
  return {
    enabled: !!process.env.WHATSAPP_ENABLED,
    connected: sock?.user?.id ? true : false,
    number: sock?.user?.id?.split(':')[0] || null,
  };
}
```

**Important note:** At the top of this file, add this import:
```javascript
import pino from 'pino';
```

### 3. Update src/index.js

Add WhatsApp initialization after Telegram:

Find this line:
```javascript
import { startTelegram, stopTelegram } from './channels/telegram.js';
```

Add this line after it:
```javascript
import { startWhatsApp, stopWhatsApp } from './channels/whatsapp-baileys.js';
```

Then find this line:
```javascript
startTelegram();
```

Add this line after it:
```javascript
startWhatsApp();
```

Then find this line:
```javascript
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopTelegram();
  server.close(() => { logger.info('server closed'); process.exit(0); });
});
```

Update it to:
```javascript
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopTelegram();
  stopWhatsApp();
  server.close(() => { logger.info('server closed'); process.exit(0); });
});
```

Also update the SIGINT handler:
```javascript
process.on('SIGINT', () => {
  stopTelegram();
  stopWhatsApp();
  server.close(() => process.exit(0));
});
```

### 4. Create .env configuration

Edit `.env.example` and add:

```bash
# ── WhatsApp (Baileys direct integration) ──────────────────────────────────
# Set this to enable WhatsApp. No additional setup needed beyond .env
# Leave empty to disable WhatsApp.
WHATSAPP_ENABLED=true
```

### 5. Update data directory .gitignore

Create/update `data/.gitignore`:

```bash
# WhatsApp session data (contains encryption keys)
whatsapp-sessions/

# Task and agent files (runtime data)
tasks.json
agents.json
```

### 6. Update CLAUDE.md

Add a new section after the Telegram section:

```markdown
### WhatsApp setup (Baileys direct integration)

Unlike Twilio (third-party), this uses Baileys for direct WhatsApp connection via the official multi-device API. No costs, no external dependencies.

1. Ensure `.env` has `WHATSAPP_ENABLED=true`
2. Start the service: `node src/index.js`
3. You will see: **"Scan this QR with your phone camera"**
4. Open WhatsApp on your phone → **Settings → Linked devices → Link a device**
5. Scan the QR code shown in your terminal
6. Wait 3-5 seconds for connection to establish
7. Start sending commands to your WhatsApp account:

| Message | Action |
|---------|--------|
| `status` | Service health |
| `tasks` | List tasks |
| `add <title>` | Create task |
| `agents` | List agents |
| `help` | Show commands |

**Session persistence**: Your WhatsApp connection is saved in `data/whatsapp-sessions/`. On restart, the service reconnects automatically without needing a new QR scan.

**Cost**: Free. No Twilio account or charges.

**Limitations**: This is an unofficial integration. Bulk messaging or spam will result in IP bans from WhatsApp. Use responsibly.

**Comparison with Twilio**:
| Feature | Baileys | Twilio |
|---------|---------|--------|
| Cost | Free | ~$0.02/message |
| Setup | QR code scan | Business account |
| Official | Unofficial | Official |
| Scalability | Single device | High volume |
```

### 7. Verification

Run these checks to confirm setup is complete:

```bash
# 1. Verify package.json has Baileys
grep -q "@whiskeysockets/baileys" package.json && echo "✓ Baileys installed" || echo "✗ Baileys missing"

# 2. Verify whatsapp-baileys.js exists
test -f src/channels/whatsapp-baileys.js && echo "✓ WhatsApp module created" || echo "✗ Missing"

# 3. Verify src/index.js imports WhatsApp
grep -q "whatsapp-baileys" src/index.js && echo "✓ Import added" || echo "✗ Missing"

# 4. Verify .env has WHATSAPP_ENABLED
grep -q "WHATSAPP_ENABLED" .env && echo "✓ .env configured" || echo "✗ Missing"

# 5. Start service and check for QR code
node src/index.js
# Should show: "whatsapp: scan this QR..."
```

## User Instructions (after this skill completes)

### First Time Setup

1. Make sure `.env` has `WHATSAPP_ENABLED=true`
2. Start the service:
   ```bash
   node src/index.js
   ```
3. Watch the terminal output for:
   ```
   whatsapp: scan this QR with your phone camera...
   ```
4. Open **WhatsApp on your phone** → **Settings → Linked devices → Link a device**
5. **Point your phone camera at the QR code** in your terminal
6. Wait 3-5 seconds for the QR to be scanned
7. Service will log: **"whatsapp: connected and ready"**
8. Now you can send commands to WhatsApp!

### Testing Commands

Send these messages to **your own WhatsApp account** (or create a test group):

```
You → WhatsApp Bot: status
Bot → You: Status: ok, Uptime: 45s, Tasks: 3

You → WhatsApp Bot: tasks
Bot → You: Tasks:
• Task 1 (pending)
• Task 2 (in_progress)
• Task 3 (done)

You → WhatsApp Bot: add Buy milk
Bot → You: ✓ Created: "Buy milk"

You → WhatsApp Bot: help
Bot → You: Commands:
• status - service health
• tasks - list tasks
• add <title> - create task
• agents - list agents
• help - show this
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| No QR code appears | Check `.env` has `WHATSAPP_ENABLED=true`, restart service |
| QR scans but connection fails | Your WhatsApp account might be restricted. Try on a different account. |
| Service loses connection | Normal — it auto-reconnects. Check logs with: `tail -f /tmp/my-service.log \| grep whatsapp` |
| "WARN whatsapp: disconnected" | This is normal during reconnection. Connection re-establishes in ~3s. |
| Session files keep growing | Normal. Session data grows slowly. Clean with: `rm -rf data/whatsapp-sessions/` to reset. |

### Production Notes

**Important**: This is an unofficial WhatsApp integration. WhatsApp could change their protocol at any time, breaking this integration. For production:
- Monitor WhatsApp updates and Baileys releases
- Consider keeping Twilio as fallback
- Don't use for bulk messaging (will get IP banned)
- Use for personal/team automation only

## After This Skill Completes

Tell Claude: "Test WhatsApp integration" or "Send a WhatsApp message"

Claude will help you verify everything is working correctly.
