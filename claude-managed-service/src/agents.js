import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';
import { logger } from './logger.js';
import { emitter } from './emitter.js';

const dataDir   = resolve(process.cwd(), config.dataDir);
const agentFile = resolve(dataDir, 'agents.json');

// Agents are considered stale if no heartbeat in this many ms
const STALE_MS = 30_000;

function ensureFile() {
  if (!existsSync(agentFile)) writeFileSync(agentFile, '{}', 'utf8');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(readFileSync(agentFile, 'utf8')); }
  catch { return {}; }
}

function writeAll(agents) {
  ensureFile();
  writeFileSync(agentFile, JSON.stringify(agents, null, 2), 'utf8');
}

function markStale(agent) {
  const age = Date.now() - new Date(agent.lastHeartbeat).getTime();
  return age > STALE_MS ? { ...agent, status: 'stale' } : agent;
}

export const agentStore = {
  list() {
    const raw = readAll();
    return Object.values(raw).map(markStale);
  },

  get(id) {
    const raw = readAll();
    return raw[id] ? markStale(raw[id]) : null;
  },

  register({ id, name, capability = 'general', metadata = {} }) {
    const agents = readAll();
    const now = new Date().toISOString();
    const agent = {
      id,
      name: name ?? id,
      capability,
      status: 'idle',
      currentTask: null,
      registeredAt: agents[id]?.registeredAt ?? now,
      lastHeartbeat: now,
      metadata,
    };
    agents[id] = agent;
    writeAll(agents);
    logger.info('agent registered', { id });
    emitter.emit({ type: 'agent.registered', agent });
    return agent;
  },

  update(id, patch) {
    const agents = readAll();
    if (!agents[id]) return null;
    agents[id] = {
      ...agents[id],
      ...patch,
      id,                              // id is immutable
      lastHeartbeat: new Date().toISOString(),
    };
    writeAll(agents);
    logger.info('agent updated', { id, status: agents[id].status });
    emitter.emit({ type: 'agent.updated', agent: agents[id] });
    return agents[id];
  },

  delete(id) {
    const agents = readAll();
    if (!agents[id]) return false;
    const agent = agents[id];
    delete agents[id];
    writeAll(agents);
    logger.info('agent deregistered', { id });
    emitter.emit({ type: 'agent.removed', id });
    return true;
  },

  pruneStale() {
    const agents = readAll();
    let pruned = 0;
    for (const [id, agent] of Object.entries(agents)) {
      const age = Date.now() - new Date(agent.lastHeartbeat).getTime();
      if (age > STALE_MS * 4 && agent.status === 'stale') {
        delete agents[id];
        pruned++;
        emitter.emit({ type: 'agent.removed', id });
      }
    }
    if (pruned > 0) {
      writeAll(agents);
      logger.info('pruned stale agents', { count: pruned });
    }
  },
};
