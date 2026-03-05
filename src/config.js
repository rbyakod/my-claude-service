import { readFileSync } from 'fs';
import { resolve } from 'path';

const configPath = resolve(process.cwd(), 'config/default.json');

function loadConfig() {
  try {
    const raw = readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);

    if (!cfg.port || typeof cfg.port !== 'number') {
      throw new Error('config.port must be a number');
    }
    if (!cfg.maxTasks || typeof cfg.maxTasks !== 'number') {
      throw new Error('config.maxTasks must be a number');
    }

    return cfg;
  } catch (err) {
    console.error(`[config] Failed to load ${configPath}: ${err.message}`);
    process.exit(1);
  }
}

export const config = loadConfig();
