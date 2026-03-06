import { store } from '../store.js';
import { logger } from '../logger.js';
import {
  readBody, sanitizeForClaude, hasInjectionAttempt,
  VALID_TASK_STATUSES, VALID_PRIORITIES,
} from '../security.js';

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleTasks(req, res, urlParts) {
  const method = req.method;
  const id     = urlParts[1]; // urlParts is ['tasks', id]

  try {
    // GET /tasks
    if (method === 'GET' && !id) {
      const status = new URL(req.url, 'http://x').searchParams.get('status') ?? undefined;
      // Validate status query param against allowlist
      if (status && !VALID_TASK_STATUSES.has(status)) {
        return json(res, 400, { error: `status must be one of: ${[...VALID_TASK_STATUSES].join(', ')}` });
      }
      return json(res, 200, store.list(status));
    }

    // POST /tasks
    if (method === 'POST' && !id) {
      const body = await readBody(req);
      if (!body.title || typeof body.title !== 'string')
        return json(res, 400, { error: 'title is required and must be a string' });

      if (hasInjectionAttempt(body.title)) {
        logger.warn('tasks: injection attempt in title');
        return json(res, 400, { error: 'Invalid characters in title' });
      }

      const priority = body.priority ?? 'normal';
      if (!VALID_PRIORITIES.has(priority))
        return json(res, 400, { error: `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}` });

      const title = sanitizeForClaude(body.title, 300);
      if (!title) return json(res, 400, { error: 'title cannot be empty after sanitization' });

      return json(res, 201, store.create({ title, priority }));
    }

    // PATCH /tasks/:id
    if (method === 'PATCH' && id) {
      const body = await readBody(req);

      // Only allow specific fields to be updated
      const allowedFields = ['status', 'priority'];
      const unknownFields = Object.keys(body).filter(k => !allowedFields.includes(k));
      if (unknownFields.length > 0) {
        return json(res, 400, { error: `Unknown fields: ${unknownFields.join(', ')}` });
      }

      if (body.status !== undefined && !VALID_TASK_STATUSES.has(body.status))
        return json(res, 400, { error: `status must be one of: ${[...VALID_TASK_STATUSES].join(', ')}` });

      if (body.priority !== undefined && !VALID_PRIORITIES.has(body.priority))
        return json(res, 400, { error: `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}` });

      // Build patch with only allowed fields
      const patch = {};
      if (body.status !== undefined) patch.status = body.status;
      if (body.priority !== undefined) patch.priority = body.priority;

      const task = store.update(id, patch);
      return task ? json(res, 200, task) : json(res, 404, { error: 'Task not found' });
    }

    // DELETE /tasks/:id
    if (method === 'DELETE' && id) {
      const deleted = store.delete(id);
      if (!deleted) return json(res, 404, { error: 'Task not found' });
      res.writeHead(204); return res.end();
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    logger.error('tasks route error', { error: err.message });
    // Do not leak internal error details to callers
    json(res, err.status ?? 500, { error: err.status ? err.message : 'Internal server error' });
  }
}
