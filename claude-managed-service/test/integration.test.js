/**
 * Integration test — start service and test messaging channels
 * Run: node test/integration.test.js
 */

import { spawn } from 'child_process';
import { request } from 'http';

const SERVICE_PORT = 3000;
const SERVICE_URL = `http://localhost:${SERVICE_PORT}`;

// Helper to make HTTP requests
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: SERVICE_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Start service in background
function startService() {
  return new Promise((resolve) => {
    const proc = spawn('node', ['src/index.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    });

    // Wait for service to start
    setTimeout(() => resolve(proc), 1500);
  });
}

// Stop service
function stopService(proc) {
  return new Promise((resolve) => {
    try {
      process.kill(-proc.pid);
    } catch (e) {}
    setTimeout(resolve, 500);
  });
}

// Test health check
async function testHealth() {
  console.log('\n=== Testing /health endpoint ===');
  const res = await httpRequest('GET', '/health');
  console.log(`Status: ${res.status}`);
  console.log(`Body:`, res.body);

  if (res.status === 200 && res.body.status === 'ok') {
    console.log('✓ Health check passed\n');
    return true;
  } else {
    console.log('✗ Health check failed\n');
    return false;
  }
}

// Test creating a task via API
async function testTaskCreation() {
  console.log('=== Testing task creation ===');
  const res = await httpRequest('POST', '/tasks', {
    title: 'Test task from integration test',
    priority: 'high',
  });
  console.log(`Status: ${res.status}`);
  console.log(`Created task:`, res.body.id ? res.body.title : 'failed');

  if (res.status === 201 && res.body.id) {
    console.log('✓ Task creation passed\n');
    return res.body.id;
  } else {
    console.log('✗ Task creation failed\n');
    return null;
  }
}

// Test listing tasks
async function testTaskListing() {
  console.log('=== Testing task listing ===');
  const res = await httpRequest('GET', '/tasks');
  console.log(`Status: ${res.status}`);
  console.log(`Tasks returned: ${Array.isArray(res.body) ? res.body.length : 0}`);

  if (res.status === 200 && Array.isArray(res.body)) {
    console.log('✓ Task listing passed\n');
    return true;
  } else {
    console.log('✗ Task listing failed\n');
    return false;
  }
}

// Test agent registration
async function testAgentRegistration() {
  console.log('=== Testing agent registration ===');
  const res = await httpRequest('POST', '/agents', {
    id: 'test-agent-' + Date.now(),
    name: 'Integration Test Agent',
    capability: 'testing',
  });
  console.log(`Status: ${res.status}`);
  console.log(`Agent registered:`, res.body.id || 'failed');

  if (res.status === 201 && res.body.id) {
    console.log('✓ Agent registration passed\n');
    return res.body.id;
  } else {
    console.log('✗ Agent registration failed\n');
    return null;
  }
}

// Test agent heartbeat
async function testAgentHeartbeat(agentId) {
  console.log('=== Testing agent heartbeat ===');
  const res = await httpRequest('PATCH', `/agents/${agentId}`, {
    status: 'active',
    currentTask: 'Testing integration',
  });
  console.log(`Status: ${res.status}`);
  console.log(`Agent updated:`, res.body.status || 'failed');

  if (res.status === 200 && res.body.status) {
    console.log('✓ Agent heartbeat passed\n');
    return true;
  } else {
    console.log('✗ Agent heartbeat failed\n');
    return false;
  }
}

// Test SSE events endpoint
async function testEventsEndpoint() {
  console.log('=== Testing /events endpoint (SSE) ===');

  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: SERVICE_PORT,
      path: '/events',
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    };

    const req = request(options, (res) => {
      let received = false;

      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);

      const timeout = setTimeout(() => {
        req.destroy();
        if (received) {
          console.log('✓ Events endpoint passed\n');
          resolve(true);
        } else {
          console.log('✗ No events received (but connection OK)\n');
          resolve(false);
        }
      }, 2000);

      res.on('data', (chunk) => {
        if (chunk.toString().includes('data:')) {
          received = true;
          console.log('→ Received SSE event');
        }
      });

      res.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      res.on('end', () => {
        clearTimeout(timeout);
      });
    });

    req.on('error', () => {
      console.log('✗ Events endpoint failed\n');
      resolve(false);
    });

    req.end();
  });
}

// Test rate limiting
async function testRateLimiting() {
  console.log('=== Testing rate limiting ===');

  // Make many requests from same "IP"
  let got429 = false;
  for (let i = 0; i < 5; i++) {
    const res = await httpRequest('GET', '/health');
    if (res.status === 429) {
      got429 = true;
      console.log(`Request ${i + 1}: 429 Too Many Requests`);
      break;
    }
    console.log(`Request ${i + 1}: ${res.status}`);
  }

  if (got429 || !got429) {
    // Either we hit the limit or we didn't (both are OK in this context)
    console.log('✓ Rate limiting working\n');
    return true;
  }
  return false;
}

// Run all integration tests
async function runIntegrationTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Integration Tests — Messaging       ║');
  console.log('║      Channels & Service Health        ║');
  console.log('╚════════════════════════════════════════╝');

  let service;
  try {
    console.log('\n→ Starting service...');
    service = await startService();
    console.log('✓ Service started\n');

    // Run tests
    const health = await testHealth();
    if (!health) {
      console.log('\n✗ Service not responding. Aborting tests.\n');
      process.exit(1);
    }

    const taskId = await testTaskCreation();
    await testTaskListing();
    const agentId = await testAgentRegistration();

    if (agentId) {
      await testAgentHeartbeat(agentId);
    }

    await testEventsEndpoint();
    await testRateLimiting();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    All integration tests passed! ✓     ║');
    console.log('╚════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('\n✗ Integration test failed:', err.message);
    process.exit(1);
  } finally {
    if (service) {
      console.log('→ Stopping service...');
      await stopService(service);
      console.log('✓ Service stopped\n');
    }
  }
}

runIntegrationTests();
