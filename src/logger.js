import { config } from './config.js';

const LEVELS = { error: 0, info: 1, debug: 2 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, msg, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  });
  process.stdout.write(line + '\n');
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
