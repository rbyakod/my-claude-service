import { store }      from '../store.js';
import { agentStore } from '../agents.js';
import { emitter }    from '../emitter.js';
import { config }     from '../config.js';
import { logger }     from '../logger.js';
import { sanitizeForClaude } from '../security.js';

const startedAt = Date.now();

// Maximum length for any string field in SSE output
const MAX_SSE_FIELD_LEN = 100;

// Sanitize task data for SSE broadcast (remove/limit sensitive fields)
function sanitizeTaskForSSE(task) {
  return {
    id:        task.id,
    title:     sanitizeForClaude(task.title ?? '', MAX_SSE_FIELD_LEN),
    priority:  task.priority,
    status:    task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

// Sanitize agent data for SSE broadcast (remove metadata, limit currentTask)
function sanitizeAgentForSSE(agent) {
  return {
    id:            agent.id,
    name:          sanitizeForClaude(agent.name ?? '', MAX_SSE_FIELD_LEN),
    capability:    sanitizeForClaude(agent.capability ?? '', MAX_SSE_FIELD_LEN),
    status:        agent.status,
    currentTask:   agent.currentTask ? sanitizeForClaude(agent.currentTask, MAX_SSE_FIELD_LEN) : null,
    registeredAt:  agent.registeredAt,
    lastHeartbeat: agent.lastHeartbeat,
    // Intentionally exclude metadata - may contain sensitive data
  };
}

// Sanitize mutation events before broadcasting
function sanitizeEventForSSE(event) {
  if (!event || typeof event !== 'object') return event;

  const sanitized = { ...event };

  // Sanitize task-related events
  if (sanitized.task) {
    sanitized.task = sanitizeTaskForSSE(sanitized.task);
  }

  // Sanitize agent-related events
  if (sanitized.agent) {
    sanitized.agent = sanitizeAgentForSSE(sanitized.agent);
  }

  return sanitized;
}

function buildSnapshot() {
  const tasks   = store.list();
  const byStatus = { pending: 0, in_progress: 0, done: 0, failed: 0 };
  for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

  return {
    type: 'snapshot',
    ts: new Date().toISOString(),
    health: {
      status:  'ok',
      uptime:  Math.floor((Date.now() - startedAt) / 1000),
      port:    config.port,
      version: process.env.npm_package_version ?? '1.0.0',
    },
    tasks: {
      total:    tasks.length,
      byStatus,
      recent:   tasks.slice(-20).reverse().map(sanitizeTaskForSSE),
    },
    agents: agentStore.list().map(sanitizeAgentForSSE),
  };
}

export function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',   // tell nginx not to buffer SSE
  });
  res.write(':\n\n'); // initial flush / comment keeps connection alive

  function send(data) {
    if (res.destroyed) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Send immediate full snapshot
  send(buildSnapshot());

  // Push a fresh snapshot every 3 seconds
  const ticker = setInterval(() => send(buildSnapshot()), 3000);

  // Also push targeted mutation events immediately when they happen
  const unsubscribe = emitter.subscribe(event => send(sanitizeEventForSSE(event)));

  req.on('close', () => {
    clearInterval(ticker);
    unsubscribe();
    logger.debug('SSE client disconnected');
  });

  logger.debug('SSE client connected', { clients: emitter.listenerCount() });
}
