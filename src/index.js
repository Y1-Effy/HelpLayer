import { createToggleController } from './toggle.js';

/**
 * Initialize the help mode.
 *
 * It can be toggled ON/OFF by clicking the toggle element, and also controlled programmatically
 * via the returned API. If `toggle` is omitted, there's no DOM toggle and it's programmatic-only.
 *
 * @param {object} options
 * @param {import('./config.js').HelpConfig} options.config - configuration that specifies targets by data-help-id or position.
 *   Elements not in config can still be targets via the data-help-title / data-help-text inline definition (config wins)
 * @param {string|HTMLElement} [options.toggle] - toggle element that switches ON/OFF (CSS selector string or element). Optional
 * @param {() => void} [options.onEnable] - called right after the mode is turned ON
 * @param {() => void} [options.onDisable] - called right after the mode is turned OFF
 * @param {(record: import('./matcher.js').HelpRecord) => void} [options.onOpen] - called when a description popup is opened
 * @param {() => void} [options.onClose] - called when a description popup is closed
 * @param {boolean} [options.silent] - suppress the warning log for unregistered keys
 * @param {string} [options.attribute] - attribute name marking targets (default 'data-help-id')
 * @param {(record: import('./matcher.js').HelpRecord) => (Node|null|undefined)} [options.render] - render the popup body with your own DOM.
 *   Return a Node to display it; if nothing is returned, fall back to safe text display (the title is always record.title).
 *   ⚠️ The return value is inserted as-is without sanitization. If it contains untrusted data, neutralize it on the caller side (XSS prevention)
 * @param {string} [options.markerLabel] - character shown on the marker (default '?')
 * @param {import('./types.js').Placement} [options.markerPlacement] - corner to overlap the marker onto (default 'top-end')
 * @param {import('./types.js').Placement} [options.popupPlacement] - initial popup placement (default 'bottom-start')
 * @param {string} [options.nonce] - nonce to allow the injected <style> under a strict CSP (style-src 'nonce-…')
 * @returns {{
 *   enable(): void,
 *   disable(): void,
 *   toggle(): void,
 *   isActive(): boolean,
 *   open(key: string): void,
 *   close(): void,
 *   update(config: import('./config.js').HelpConfig): void,
 *   destroy(): void,
 * }} a handle to control the mode and fully clean up at the end.
 *   open(key) opens the description for the given key (auto-enables when OFF). close() closes the open description.
 */
export function initHelpLayer(options) {
  return createToggleController(options);
}
