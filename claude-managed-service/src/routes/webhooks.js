/**
 * Webhook routes for external integrations.
 *
 * Currently used for:
 * - Outbound task/agent notifications (if add-webhook skill is used)
 * - Future external service integrations
 *
 * Note: Incoming WhatsApp and Telegram use polling (not webhooks)
 * to avoid complexity with ngrok/localtunnel.
 */

import { logger } from '../logger.js';

// Read raw body (URL-encoded or JSON) with a size limit
const MAX_WEBHOOK_BYTES = 16_384;

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw  = '';
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_WEBHOOK_BYTES) {
        req.destroy();
        return reject(Object.assign(new Error('Webhook body too large'), { status: 413 }));
      }
      raw += chunk;
    });
    req.on('end',   () => resolve(raw));
    req.on('error', reject);
  });
}

export async function handleWebhook(req, res, urlParts) {
  const channel = urlParts[2]; // /webhook/<channel>

  if (req.method !== 'POST') {
    res.writeHead(405); return res.end();
  }

  try {
    await readRaw(req);

    // Placeholder for future webhook handlers
    logger.warn('webhook: no handler for channel', { channel });
    res.writeHead(404); res.end();
  } catch (err) {
    logger.error('webhook error', { channel, error: err.message });
    res.writeHead(err.status ?? 500); res.end();
  }
}
