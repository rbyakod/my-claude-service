import { createServer } from 'http';
import { config }       from './config.js';
import { logger }       from './logger.js';
import { handleHealth } from './routes/health.js';
import { handleTasks }  from './routes/tasks.js';

const server = createServer(async (req, res) => {
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const resource = urlParts[0];

  logger.debug('request', { method: req.method, url: req.url });

  if (resource === 'health') return handleHealth(req, res);
  if (resource === 'tasks')  return handleTasks(req, res, urlParts);

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(config.port, () => {
  logger.info('my-service started', { port: config.port, logLevel: config.logLevel });
});

// Graceful shutdown — service managers send SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
