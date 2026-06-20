/**
 * Registry of teardown callbacks.
 * DOM, listeners, and style changes added while the mode is ON are unwound in
 * reverse order of creation (LIFO), so that dependent cleanups (e.g. detach an
 * internal listener, then remove its element) run in a natural order.
 */
export function createState() {
  const cleanupFns = [];

  return {
    track(fn) {
      cleanupFns.push(fn);
    },
    teardownAll() {
      while (cleanupFns.length > 0) {
        const cleanup = cleanupFns.pop();
        cleanup();
      }
    },
  };
}
