import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config }  from './config.js';
import { logger }  from './logger.js';
import { emitter } from './emitter.js';

const dataDir  = resolve(process.cwd(), config.dataDir);
const dataFile = resolve(dataDir, 'tasks.json');

function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  if (!existsSync(dataFile)) {
    writeFileSync(dataFile, JSON.stringify([]), 'utf8');
  }
}

function readTasks() {
  ensureDataDir();
  try {
    return JSON.parse(readFileSync(dataFile, 'utf8'));
  } catch {
    logger.error('store: corrupt data file, resetting');
    return [];
  }
}

function writeTasks(tasks) {
  ensureDataDir();
  writeFileSync(dataFile, JSON.stringify(tasks, null, 2), 'utf8');
}

export const store = {
  list(statusFilter) {
    const tasks = readTasks();
    return statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;
  },

  get(id) {
    return readTasks().find(t => t.id === id) ?? null;
  },

  create({ title, priority = 'normal' }) {
    const tasks = readTasks();
    if (tasks.length >= config.maxTasks) {
      throw new Error(`Task limit reached (max ${config.maxTasks})`);
    }
    const task = {
      id:        crypto.randomUUID(),
      title,
      priority,
      status:    'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(task);
    writeTasks(tasks);
    logger.info('store: task created', { id: task.id });
    emitter.emit({ type: 'task.created', task });
    return task;
  },

  update(id, patch) {
    const tasks = readTasks();
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
    writeTasks(tasks);
    logger.info('store: task updated', { id });
    emitter.emit({ type: 'task.updated', task: tasks[idx] });
    return tasks[idx];
  },

  delete(id) {
    const tasks = readTasks();
    const next  = tasks.filter(t => t.id !== id);
    if (next.length === tasks.length) return false;
    writeTasks(next);
    logger.info('store: task deleted', { id });
    emitter.emit({ type: 'task.deleted', id });
    return true;
  },

  count() {
    return readTasks().length;
  },
};
