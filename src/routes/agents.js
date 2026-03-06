import { agentStore } from '../agents.js';
import { logger }     from '../logger.js';
import {
  readBody, sanitizeText, sanitizeForClaude,
  hasInjectionAttempt, VALID_AGENT_STATUSES,
} from '../security.js';

const MAX_METADATA_BYTES = 1_024; // 1 KB cap on metadata

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  // Shallow sanitize — reject if serialized size exceeds cap
  const serialized = JSON.stringify(raw);
  if (serialized.length > MAX_METADATA_BYTES) return {};
  return raw;
}

export async function handleAgents(req, res, urlParts) {
  const method = req.method;
  const id     = urlParts[1]; // urlParts is ['agents', id]

  try {
    if (method === 'GET' && !id) return json(res, 200, agentStore.list());

    if (method === 'GET' && id) {
      const agent = agentStore.get(id);
      return agent ? json(res, 200, agent) : json(res, 404, { error: 'Agent not found' });
    }

    // POST /agents — register
    if (method === 'POST' && !id) {
      const body = await readBody(req);
      if (!body.id || typeof body.id !== 'string')
        return json(res, 400, { error: 'id is required and must be a string' });

      const rawId = sanitizeText(body.id, 64);
      if (!rawId || !/^[\w\-]+$/.test(rawId))
        return json(res, 400, { error: 'id must contain only letters, digits, hyphens, underscores' });

      if (hasInjectionAttempt(body.name ?? '') || hasInjectionAttempt(body.capability ?? '')) {
        logger.warn('agents: injection attempt in register');
        return json(res, 400, { error: 'Invalid characters in name or capability' });
      }

      const agent = agentStore.register({
        id:         rawId,
        name:       sanitizeText(body.name ?? rawId, 100),
        capability: sanitizeText(body.capability ?? 'general', 100),
        metadata:   sanitizeMetadata(body.metadata),
      });
      return json(res, 201, agent);
    }

    // PATCH /agents/:id — update status / heartbeat
    if (method === 'PATCH' && id) {
      const body = await readBody(req);
      if (body.status && !VALID_AGENT_STATUSES.has(body.status))
        return json(res, 400, { error: `status must be one of: ${[...VALID_AGENT_STATUSES].join(', ')}` });

      if (hasInjectionAttempt(body.currentTask ?? '')) {
        logger.warn('agents: injection attempt in currentTask');
        return json(res, 400, { error: 'Invalid characters in currentTask' });
      }

      const patch = {
        ...(body.status      && { status:      body.status }),
        ...(body.currentTask !== undefined && {
          currentTask: body.currentTask ? sanitizeForClaude(body.currentTask, 200) : null,
        }),
        ...(body.metadata    && { metadata: sanitizeMetadata(body.metadata) }),
      };
      const agent = agentStore.update(id, patch);
      return agent ? json(res, 200, agent) : json(res, 404, { error: 'Agent not found' });
    }

    // DELETE /agents/:id
    if (method === 'DELETE' && id) {
      const deleted = agentStore.delete(id);
      if (!deleted) return json(res, 404, { error: 'Agent not found' });
      res.writeHead(204); return res.end();
    }

    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    logger.error('agents route error', { error: err.message });
    json(res, err.status ?? 500, { error: err.status ? err.message : 'Internal server error' });
  }
}
