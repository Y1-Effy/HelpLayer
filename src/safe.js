/**
 * Isolation for user-supplied callbacks (render / onOpen / onClose / onEnable / onDisable).
 *
 * These run inside the library's own control flow (event handlers, teardown), so a throw from a
 * caller's mistake must not derail us: it could leave a popup half-open or abort a teardown midway,
 * stranding markers, observers and injected styles. We swallow the error and log it instead, so the
 * developer still sees their bug while the library keeps its internal state consistent.
 */

/**
 * Invoke a user callback, never letting it throw into library code.
 * @template T
 * @param {string} label name used in the error log (e.g. 'onClose')
 * @param {((...args: any[]) => T)|undefined|null} fn the callback, or nullish to skip
 * @param {...any} args arguments forwarded to fn
 * @returns {T|undefined} fn's return value, or undefined when absent or it threw
 */
export function safeInvoke(label, fn, ...args) {
  if (!fn) {
    return undefined;
  }
  try {
    return fn(...args);
  } catch (err) {
    // Always logged regardless of `silent` (that flag only gates unregistered-key warnings).
    console.error(`[help-layer] ${label} threw:`, err);
    return undefined;
  }
}
