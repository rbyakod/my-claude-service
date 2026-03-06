import { createServer } from 'http';
import { readFileSync }  from 'fs';
import { resolve }       from 'path';
import { config }        from './config.js';
import { logger }        from './logger.js';
import { agentStore }    from './agents.js';
import { handleHealth }  from './routes/health.js';
import { handleTasks }   from './routes/tasks.js';
import { handleAgents }  from './routes/agents.js';
import { handleEvents }  from './routes/events.js';
import { handleWebhook } from './routes/webhooks.js';
import { addSecurityHeaders, isAuthenticated, isRateLimited } from './security.js';
import { startTelegram, stopTelegram } from './channels/telegram.js';

const dashboardPath = resolve(process.cwd(), 'public/dashboard.html');

// Public routes that bypass API key check
const PUBLIC_ROUTES = new Set(['health', 'dashboard', 'webhook', 'events', '']);

const server = createServer(async (req, res) => {
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const resource = urlParts[0] ?? '';

  // ── Security: add headers to every response ───────────────────────────────
  addSecurityHeaders(res);

  // ── Security: rate limiting (per IP) ─────────────────────────────────────
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too many requests' }));
  }

  // ── Security: API key check on non-public routes ──────────────────────────
  if (!PUBLIC_ROUTES.has(resource) && !isAuthenticated(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized — set X-API-Key header' }));
  }

  logger.debug('request', { method: req.method, url: req.url });

  if (resource === 'health')    return handleHealth(req, res);
  if (resource === 'tasks')     return handleTasks(req, res, urlParts);
  if (resource === 'agents')    return handleAgents(req, res, urlParts);
  if (resource === 'events')    return handleEvents(req, res);
  if (resource === 'webhook')   return handleWebhook(req, res, urlParts);

  // Serve dashboard at GET / and GET /dashboard
  if (req.method === 'GET' && (!resource || resource === 'dashboard')) {
    try {
      const html = readFileSync(dashboardPath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Dashboard not found — is public/dashboard.html present?');
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(config.port, () => {
  logger.info('my-service started', {
    port: config.port, logLevel: config.logLevel,
    dashboard:    `http://localhost:${config.port}/dashboard`,
    authRequired: !!process.env.API_KEY,
  });
});

// Start message channels (only if env vars are set)
startTelegram();

// Prune long-dead agents every 60 seconds
setInterval(() => agentStore.pruneStale(), 60_000);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopTelegram();
  server.close(() => { logger.info('server closed'); process.exit(0); });
});
process.on('SIGINT', () => {
  stopTelegram();
  server.close(() => process.exit(0));
});
