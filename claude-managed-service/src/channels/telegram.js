/**
 * Telegram channel — long-polling bot.
 *
 * Requires env vars:
 *   TELEGRAM_BOT_TOKEN          — from @BotFather
 *   TELEGRAM_ALLOWED_CHAT_IDS   — comma-separated numeric chat IDs (REQUIRED for security)
 *
 * Commands:
 *   /status          — service health
 *   /tasks [status]  — list tasks, optionally filtered
 *   /add <title>     — create a new task
 *   /agents          — list registered agents
 *   /help            — command list
 */

import { request as httpsRequest } from 'https';
import { store }      from '../store.js';
import { agentStore } from '../agents.js';
import { logger }     from '../logger.js';
import { sanitizeForClaude, hasInjectionAttempt } from '../security.js';

const TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '').split(',').filter(Boolean).map(s => Number(s.trim()))
);

let _lastUpdateId = 0;
let _pollTimer    = null;
let _running      = false;

// ── Telegram API helper ───────────────────────────────────────────────────────
function apiCall(method, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const opts = {
      hostname: 'api.telegram.org',
      path:     `/bot${TOKEN}/${method}`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': data.length },
      timeout:  15_000,
    };
    const req = httpsRequest(opts, res => {
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { reject(new Error(`Bad Telegram response: ${buf.slice(0, 80)}`)); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Telegram API timeout')); });
    req.end(data);
  });
}

function send(chatId, text) {
  // Use plain text (no parse_mode) — prevents any markdown interpretation of user data
  return apiCall('sendMessage', { chat_id: chatId, text });
}

// ── Command handlers ──────────────────────────────────────────────────────────
const startedAt = Date.now();

async function handleCommand(chatId, text) {
  const parts = text.trim().split(/\s+/);
  // Strip @BotName suffix if command was sent in a group
  const cmd = (parts[0] ?? '').toLowerCase().replace(/@\w+$/, '');
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/start':
    case '/help':
      return send(chatId,
        'my-service commands:\n' +
        '/status         — service health\n' +
        '/tasks          — all tasks\n' +
        '/tasks pending  — filter by status\n' +
        '/add <title>    — create a task\n' +
        '/agents         — list agents\n' +
        '/help           — this message'
      );

    case '/status': {
      const uptime = Math.floor((Date.now() - startedAt) / 1000);
      const count  = store.count();
      const agents = agentStore.list().filter(a => a.status !== 'stale');
      return send(chatId,
        `Service: OK\nUptime: ${uptime}s\nTasks: ${count}\nActive agents: ${agents.length}`
      );
    }

    case '/tasks': {
      const validStatuses = ['pending', 'in_progress', 'done', 'failed'];
      const filter = validStatuses.includes(arg) ? arg : undefined;
      const tasks  = store.list(filter).slice(-10).reverse();
      if (!tasks.length) return send(chatId, 'No tasks found.');
      const lines = tasks.map(t =>
        `[${t.status}] ${t.title} (${t.priority})`
      ).join('\n');
      return send(chatId, `Tasks${filter ? ` (${filter})` : ''}:\n${lines}`);
    }

    case '/add': {
      if (!arg) return send(chatId, 'Usage: /add <task title>');
      if (hasInjectionAttempt(arg)) {
        logger.warn('telegram: injection attempt in /add', { chatId });
        return send(chatId, 'Invalid task title.');
      }
      const title = sanitizeForClaude(arg, 200);
      if (!title) return send(chatId, 'Task title cannot be empty.');
      const task = store.create({ title });
      return send(chatId, `Task created: ${task.id.slice(0, 8)}\n${title}`);
    }

    case '/agents': {
      const agents = agentStore.list();
      if (!agents.length) return send(chatId, 'No agents registered.');
      const lines = agents.map(a =>
        `[${a.status}] ${a.name} — ${a.currentTask ?? 'idle'}`
      ).join('\n');
      return send(chatId, `Agents:\n${lines}`);
    }

    default:
      return send(chatId, 'Unknown command. Use /help');
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────
async function poll() {
  if (!_running) return;
  try {
    const result = await apiCall('getUpdates', {
      offset:          _lastUpdateId + 1,
      timeout:         10,                    // long-poll for up to 10s
      allowed_updates: ['message'],
    });

    if (result.ok && result.result.length) {
      for (const update of result.result) {
        _lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg?.text?.startsWith('/')) continue; // only handle commands

        const chatId = msg.chat.id;
        if (ALLOWED_IDS.size > 0 && !ALLOWED_IDS.has(chatId)) {
          logger.warn('telegram: message from unauthorized chat', { chatId });
          send(chatId, 'You are not authorized to use this bot.').catch(() => {});
          continue;
        }

        handleCommand(chatId, msg.text).catch(err =>
          logger.error('telegram: command error', { chatId, error: err.message })
        );
      }
    }
  } catch (err) {
    logger.error('telegram: poll error', { error: err.message });
  }

  _pollTimer = setTimeout(poll, 1_000);
}

// ── Public API ────────────────────────────────────────────────────────────────
export function startTelegram() {
  if (!TOKEN) {
    logger.info('telegram: TELEGRAM_BOT_TOKEN not set — channel disabled');
    return;
  }
  if (ALLOWED_IDS.size === 0) {
    logger.warn('telegram: TELEGRAM_ALLOWED_CHAT_IDS is empty — ALL chats can use this bot!');
  }
  _running = true;
  logger.info('telegram: channel started (polling)');
  poll();
}

export function stopTelegram() {
  _running = false;
  if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
  logger.info('telegram: channel stopped');
}
