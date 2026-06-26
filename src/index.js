import { createToggleController } from './toggle.js';

/**
 * Public type aliases, re-exported here so consumers can
 * `import type { HelpConfig, HelpEntry, HelpRecord, Placement } from 'help-layer'`
 * instead of reaching into internal modules or peeling them off the function signature.
 * @typedef {import('./config.js').HelpConfig} HelpConfig
 * @typedef {import('./config.js').HelpEntry} HelpEntry
 * @typedef {import('./matcher.js').HelpRecord} HelpRecord
 * @typedef {import('./types.js').Placement} Placement
 * @typedef {import('./diagnostics.js').RuntimeReport} RuntimeReport
 */

/**
 * Options accepted by initHelpLayer(). Keep in sync with the destructuring and KNOWN_OPTIONS in toggle.js.
 * @typedef {object} HelpLayerOptions
 * @property {HelpConfig} [config] configuration that specifies targets by data-help-id or position.
 *   Optional: omit it to define targets purely via the data-help-title / data-help-text inline definition.
 *   Elements not in config can still be targets via that inline definition (config wins)
 * @property {string|HTMLElement} [toggle] toggle element that switches ON/OFF (CSS selector string or element). Optional
 * @property {() => void} [onEnable] called right after the mode is turned ON
 * @property {() => void} [onDisable] called right after the mode is turned OFF
 * @property {(record: HelpRecord) => void} [onOpen] called when a description popup is opened
 * @property {() => void} [onClose] called when a description popup is closed
 * @property {boolean} [silent] suppress non-fatal warning logs (unregistered keys, unknown options, duplicate-id open)
 * @property {string} [attribute] attribute name marking targets (default 'data-help-id')
 * @property {(record: HelpRecord) => (Node|null|undefined)} [render] render the popup body with your own DOM.
 *   Return a Node to display it; if nothing is returned, fall back to safe text display (the title is always record.title).
 *   ⚠️ The return value is inserted as-is without sanitization. If it contains untrusted data, neutralize it on the caller side (XSS prevention)
 * @property {string} [markerLabel] character shown on the marker (default '?')
 * @property {Placement} [markerPlacement] corner to overlap the marker onto (default 'top-end')
 * @property {Placement} [popupPlacement] initial popup placement (default 'bottom-start')
 * @property {string} [nonce] nonce to allow the injected <style> under a strict CSP (style-src 'nonce-…')
 * @property {boolean} [debug] dev aid: also expose diagnose() as window.helpLayerDiagnose for the devtools console
 */

/**
 * The handle returned by initHelpLayer(): control the mode and fully clean up at the end.
 * @typedef {object} HelpLayerController
 * @property {() => void} enable turn the mode ON
 * @property {() => void} disable turn the mode OFF
 * @property {() => void} toggle flip the mode ON/OFF
 * @property {() => boolean} isActive whether the mode is currently ON
 * @property {(key: string) => void} open open the description for the given key (auto-enables when OFF). If several
 *   elements share that data-help-id, opens the first one (mount order) and warns; give each a unique id
 *   (or use a free-placement key) to target a specific element
 * @property {() => void} close close the open description (the mode stays ON)
 * @property {(config: HelpConfig) => void} update replace the config (rebuilds silently if ON; onEnable/onDisable are not called)
 * @property {() => RuntimeReport} diagnose scan the live DOM and log/return how the current config maps onto it (works ON or OFF)
 * @property {() => void} destroy detach listeners and fully clean up everything it added
 */

/**
 * Initialize the help mode.
 *
 * It can be toggled ON/OFF by clicking the toggle element, and also controlled programmatically
 * via the returned API. If `toggle` is omitted, there's no DOM toggle and it's programmatic-only.
 *
 * @param {HelpLayerOptions} options
 * @returns {HelpLayerController} a handle to control the mode and fully clean up at the end.
 */
export function initHelpLayer(options) {
  return createToggleController(options);
}
