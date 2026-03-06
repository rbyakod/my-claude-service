import { config } from './config.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

// Fields that should never be logged (sensitive data)
const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key', 'authorization',
  'credential', 'private', 'key', 'session', 'cookie',
]);

// Maximum length for string values in logs
const MAX_LOG_VALUE_LEN = 200;

// Recursively sanitize an object for logging
function sanitizeForLog(obj, depth = 0) {
  if (depth > 4) return '[truncated]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && obj.length > MAX_LOG_VALUE_LEN) {
      return obj.slice(0, MAX_LOG_VALUE_LEN) + '...';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => sanitizeForLog(item, depth + 1));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token')) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeForLog(value, depth + 1);
    }
  }
  return result;
}

function log(level, msg, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  const sanitizedMeta = sanitizeForLog(meta);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...sanitizedMeta,
  });
  process.stdout.write(line + '\n');
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
