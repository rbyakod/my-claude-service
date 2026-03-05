import { store } from '../store.js';
import { logger } from '../logger.js';

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export async function handleTasks(req, res, urlParts) {
  const method = req.method;
  const id     = urlParts[2]; // /tasks/:id

  try {
    // GET /tasks
    if (method === 'GET' && !id) {
      const status = new URL(req.url, 'http://x').searchParams.get('status');
      return json(res, 200, store.list(status));
    }

    // POST /tasks
    if (method === 'POST' && !id) {
      const body = await readBody(req);
      if (!body.title || typeof body.title !== 'string') {
        return json(res, 400, { error: 'title is required and must be a string' });
      }
      const validPriorities = ['low', 'normal', 'high'];
      if (body.priority && !validPriorities.includes(body.priority)) {
        return json(res, 400, { error: `priority must be one of: ${validPriorities.join(', ')}` });
      }
      const task = store.create({ title: body.title.trim(), priority: body.priority });
      return json(res, 201, task);
    }

    // PATCH /tasks/:id
    if (method === 'PATCH' && id) {
      const body = await readBody(req);
      const validStatuses = ['pending', 'in_progress', 'done', 'failed'];
      if (body.status && !validStatuses.includes(body.status)) {
        return json(res, 400, { error: `status must be one of: ${validStatuses.join(', ')}` });
      }
      const task = store.update(id, { status: body.status });
      if (!task) return json(res, 404, { error: 'Task not found' });
      return json(res, 200, task);
    }

    // DELETE /tasks/:id
    if (method === 'DELETE' && id) {
      const deleted = store.delete(id);
      if (!deleted) return json(res, 404, { error: 'Task not found' });
      res.writeHead(204);
      return res.end();
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    logger.error('tasks route error', { error: err.message });
    json(res, 500, { error: err.message });
  }
}
