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
        // A throwing cleanup (e.g. a user onClose run during teardown) must not abort the rest of
        // the unwind, otherwise later-registered subsystems (markers, observer, styles) would leak.
        try {
          cleanup();
        } catch (err) {
          console.error('[help-layer] teardown step threw:', err);
        }
      }
    },
  };
}
