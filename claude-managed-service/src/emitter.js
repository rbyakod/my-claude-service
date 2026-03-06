// In-process event bus — SSE clients subscribe here.
// store.js and agents.js fire events; routes/events.js forwards them to browsers.

const listeners = new Set();

export const emitter = {
  emit(event) {
    for (const fn of listeners) fn(event);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  listenerCount() {
    return listeners.size;
  },
};
