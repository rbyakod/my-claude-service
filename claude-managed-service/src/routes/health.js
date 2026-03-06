import { store } from '../store.js';

const startedAt = Date.now();

export function handleHealth(_req, res) {
  const body = JSON.stringify({
    status:  'ok',
    uptime:  Math.floor((Date.now() - startedAt) / 1000),
    tasks:   store.count(),
    version: process.env.npm_package_version ?? '1.0.0',
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(body);
}
