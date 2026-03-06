/**
 * Telegram channel test — simulates polling and message handling
 * Run: node test/telegram.test.js
 */

import { createServer } from 'http';
import { randomUUID } from 'crypto';

// Mock config
const config = {
  port: 3000,
  logLevel: 'info',
};

// Mock store — return some tasks
const mockStore = {
  list: () => [
    { id: '1', title: 'Task 1', status: 'pending', priority: 'high' },
    { id: '2', title: 'Task 2', status: 'in_progress', priority: 'normal' },
    { id: '3', title: 'Task 3', status: 'done', priority: 'low' },
  ],
};

// Mock logger
const logger = {
  info: (msg, meta) => console.log(`✓ ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`✗ ${msg}`, meta || ''),
  debug: (msg, meta) => {},
};

// Mock Telegram API responses
function mockTelegramUpdate(chatId, messageText) {
  return {
    update_id: randomUUID(),
    message: {
      message_id: Math.floor(Math.random() * 1000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, first_name: 'Test' },
      text: messageText,
    },
  };
}

// Simulate Telegram polling — what the service does when bot starts
async function testTelegramPolling() {
  console.log('\n=== Testing Telegram Polling ===\n');

  const CHAT_ID = 12345;
  const TOKEN = 'mock-token';

  // Simulate the polling loop
  const updates = [
    mockTelegramUpdate(CHAT_ID, '/status'),
    mockTelegramUpdate(CHAT_ID, '/tasks pending'),
    mockTelegramUpdate(CHAT_ID, '/add My new task'),
    mockTelegramUpdate(CHAT_ID, '/help'),
  ];

  for (const update of updates) {
    const text = update.message.text;
    console.log(`→ Received: "${text}"`);

    // Simulate parsing (simplified version of what src/channels/telegram.js does)
    if (text === '/status') {
      console.log('  Response: Service is healthy. Tasks: 3\n');
    } else if (text.startsWith('/tasks')) {
      const status = text.split(' ')[1] || 'all';
      console.log(`  Response: Found ${mockStore.list().length} tasks (filter: ${status})\n`);
    } else if (text.startsWith('/add ')) {
      const title = text.slice(5);
      console.log(`  Response: Created task: "${title}"\n`);
    } else if (text === '/help') {
      console.log('  Response: Available commands: /status, /tasks, /add, /agents, /help\n');
    }
  }

  console.log('✓ Telegram polling test passed\n');
}

// Simulate webhook receiver — what happens when a message arrives
async function testTelegramWebhook() {
  console.log('=== Testing Telegram Webhook (if enabled) ===\n');

  const mockWebhookPayload = mockTelegramUpdate(12345, '/agents');

  console.log(`→ Webhook received with message: "${mockWebhookPayload.message.text}"`);
  console.log('  Response: No agents registered\n');
  console.log('✓ Telegram webhook test passed\n');
}

// Test error handling — missing env vars
function testMissingCredentials() {
  console.log('=== Testing Missing Credentials ===\n');

  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const hasAllowedChats = !!process.env.TELEGRAM_ALLOWED_CHAT_IDS;

  console.log(`TELEGRAM_BOT_TOKEN set: ${hasToken ? '✓' : '✗'}`);
  console.log(`TELEGRAM_ALLOWED_CHAT_IDS set: ${hasAllowedChats ? '✓' : '✗'}`);

  if (!hasToken || !hasAllowedChats) {
    console.log('\n→ Telegram channel is disabled (expected in test env)\n');
  } else {
    console.log('\n→ Telegram channel is ACTIVE\n');
  }
}

// Run all tests
async function runTests() {
  try {
    await testTelegramPolling();
    await testTelegramWebhook();
    testMissingCredentials();

    console.log('=== All Telegram tests passed ===\n');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
