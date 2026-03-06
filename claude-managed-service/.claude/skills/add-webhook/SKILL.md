# Skill: add-webhook

## When to use
Run when the user wants the service to POST notifications to an external URL when
tasks are created, updated, or deleted.

## What you do

### 1. Add webhook config to config/default.json
Add a `webhookUrl` key (empty string by default):
```json
{
  "webhookUrl": ""
}
```

### 2. Create src/webhook.js
```javascript
import { config } from './config.js';
import { logger } from './logger.js';

export async function fireWebhook(event, payload) {
  if (!config.webhookUrl) return;
  try {
    const body = JSON.stringify({ event, payload, ts: new Date().toISOString() });
    const res  = await fetch(config.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    logger.debug('webhook fired', { event, status: res.status });
  } catch (err) {
    logger.error('webhook failed', { event, error: err.message });
  }
}
```

### 3. Import and call fireWebhook in src/routes/tasks.js
After each store.create / store.update / store.delete call, add:
```javascript
await fireWebhook('task.created', task);   // or task.updated / task.deleted
```

### 4. Update CLAUDE.md
Add `webhookUrl` to the configuration table.

### 5. Ask the user for their webhook URL
Update config/default.json with their URL, then restart the service.
Offer to test it with a sample task creation.

### 6. Restart the service
macOS: `launchctl kickstart -k gui/$(id -u)/com.myservice`
Linux: `systemctl --user restart my-service`
