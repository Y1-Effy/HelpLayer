/**
 * Orchestration of the help mode's ON/OFF.
 * Starts each subsystem (style injection, marker manager, popup, blocking layer, DOM observation)
 * and aggregates their teardown into the cleanup registry (state).
 */
import { isolateBackgroundFromAT } from './aria-isolation.js';
import { activateBlockingLayer } from './blocking-layer.js';
import { isPlainObject, normalizeConfig, validateConfig } from './config.js';
import { buildRuntimeReport, formatRuntimeReport } from './diagnostics.js';
import { createMarkerManager } from './markers.js';
import {
  collectElementRecords,
  elementConfigMap,
  freeRecords,
  recordForElement,
  targetSelector,
} from './matcher.js';
import { createMutationWatcher } from './observer.js';
import { createPopupController } from './popup.js';
import { safeInvoke } from './safe.js';
import { createState } from './state.js';
import { injectStyles, removeStyles } from './style.js';

// Every option initHelpLayer() understands. Used only to warn on a likely typo (e.g. markerLabal): an
// unknown key is silently dropped by the destructuring below, so without this the mistake is invisible.
// Keep in sync with the destructuring in createToggleController() and the HelpLayerOptions typedef in index.js.
const KNOWN_OPTIONS = new Set([
  'config', 'toggle', 'onEnable', 'onDisable', 'onOpen', 'onClose',
  'silent', 'attribute', 'render', 'markerLabel', 'markerPlacement',
  'popupPlacement', 'nonce', 'debug',
]);

function resolveToggleElement(toggle) {
  if (typeof toggle === 'string') {
    const el = document.querySelector(toggle);
    if (!el) {
      throw new Error(`help-layer: toggle element not found for selector "${toggle}"`);
    }
    return /** @type {HTMLElement} */ (el);
  }
  // Reject truthy garbage (a number, a plain object, ...) early; otherwise it would be accepted as a
  // toggle and only blow up cryptically later at toggleEl.addEventListener.
  if (toggle instanceof HTMLElement) {
    return toggle;
  }
  throw new Error('help-layer: toggle must be a CSS selector string or a DOM element');
}

/**
 * @param {object} options
 * @param {object} [options.config] helpConfig. Optional — if omitted, targets are defined purely via the
 *   inline data-help-title / data-help-text attributes (config wins when both define the same key)
 * @param {string|HTMLElement} [options.toggle] DOM element that switches ON/OFF (if omitted, programmatic control only)
 * @param {() => void} [options.onEnable] called right after the mode is turned ON
 * @param {() => void} [options.onDisable] called right after the mode is turned OFF
 * @param {(record: import('./matcher.js').HelpRecord) => void} [options.onOpen] called when a popup is opened
 * @param {() => void} [options.onClose] called when a popup is closed
 * @param {boolean} [options.silent] suppress non-fatal warning logs (unregistered keys, unknown options, duplicate-id open)
 * @param {string} [options.attribute] attribute name marking targets (default 'data-help-id')
 * @param {(record: import('./matcher.js').HelpRecord) => (Node|null|undefined)} [options.render] render the popup body with your own Node
 *   (the return value is inserted as-is without sanitization, so untrusted data must be neutralized by the caller)
 * @param {string} [options.markerLabel] character shown on the marker (default '?')
 * @param {import('./types.js').Placement} [options.markerPlacement] corner to overlap the marker onto (default 'top-end')
 * @param {import('./types.js').Placement} [options.popupPlacement] initial popup placement (default 'bottom-start')
 * @param {string} [options.nonce] nonce to allow the injected <style> under a strict CSP (style-src 'nonce-…')
 * @param {boolean} [options.debug] also expose diagnose() as window.helpLayerDiagnose for the devtools console
 */
export function createToggleController(options) {
  // Validate before destructuring so initHelpLayer() / initHelpLayer(null) get a clear message
  // instead of a cryptic "Cannot destructure property 'config' of undefined".
  if (!isPlainObject(options)) {
    throw new Error('help-layer: initHelpLayer requires an options object');
  }
  const {
    config = {},
    toggle,
    onEnable,
    onDisable,
    onOpen,
    onClose,
    silent = false,
    attribute = 'data-help-id',
    render,
    markerLabel = '?',
    markerPlacement = 'top-end',
    popupPlacement = 'bottom-start',
    nonce,
    debug = false,
  } = options;

  // Catch a mistyped option (it would otherwise be dropped by the destructuring above with no signal).
  if (!silent) {
    for (const key of Object.keys(options)) {
      if (!KNOWN_OPTIONS.has(key)) {
        console.warn(`[help-layer] unknown option "${key}" (ignored). Check for a typo.`);
      }
    }
  }

  let activeConfig = config;
  validateConfig(activeConfig);
  // The toggle element is optional. If omitted, it's driven solely by programmatic control like enable()/disable().
  const toggleEl = toggle != null ? resolveToggleElement(toggle) : null;

  let state = null;
  // References to the current subsystems that exist only while ON. Hoisted because open(key)/close() touch them too.
  let popup = null;
  let markers = null;

  // Only builds the side effects (onEnable/onDisable aren't called here; they fire on the enable/disable side).
  function turnOn() {
    if (state) {
      return;
    }
    state = createState();

    // On OFF, return focus to the toggle last (at the LIFO tail) (only when there is a toggle).
    if (toggleEl) {
      state.track(() => {
        if (toggleEl.isConnected && typeof toggleEl.focus === 'function') {
          toggleEl.focus({ preventScroll: true });
        }
      });
    }

    const styleEl = injectStyles(nonce);
    state.track(() => removeStyles(styleEl));

    const items = normalizeConfig(activeConfig);
    const configMap = elementConfigMap(items);

    popup = createPopupController(state, { onClose, render, popupPlacement });
    markers = createMarkerManager(state, {
      markerLabel,
      markerPlacement,
      onMarkerClick: (record, markerEl) => {
        if (popup.isOpen(record.id)) {
          popup.close();
          return;
        }
        popup.open(record, markerEl);
        safeInvoke('onOpen', onOpen, record);
      },
      // When overlap avoidance moves a marker, make the open popup follow.
      onOverlapResolved: () => popup.reposition(),
      // If a target is hidden (e.g. display:none) while its popup is open, close it (its marker just
      // collapsed to 0x0) — same as the SPA-removal path. Return focus to the toggle since the marker
      // is no longer focusable.
      onMarkerHidden: (record) => {
        if (popup.isOpen(record.id)) {
          popup.close(toggleEl ?? undefined);
        }
      },
    });

    // Initial mount (free placements + elements currently in the DOM, including Shadow DOM)
    markers.mountAll(freeRecords(items));
    markers.mountAll(collectElementRecords(items, document, { silent, attribute }));

    // SPA dynamic elements: follow additions/removals while ON
    const watcher = createMutationWatcher({
      selector: targetSelector(attribute),
      onAdded: (el) => {
        const record = recordForElement(el, configMap, attribute);
        if (record && !markers.has(record.id)) {
          markers.mount(record);
        }
      },
      onRemoved: (el) => {
        // Both the target and its marker disappear, so return focus to the toggle (or the default if absent).
        if (popup.isOpen(el)) {
          popup.close(toggleEl ?? undefined);
        }
        markers.unmount(el);
      },
    });
    state.track(() => watcher.disconnect());

    const isLibraryElement = (target) =>
      !!target &&
      ((toggleEl ? toggleEl.contains(target) : false) ||
        popup.root.contains(target) ||
        (typeof target.closest === 'function' && !!target.closest('.help-layer-marker')));

    const layer = activateBlockingLayer(state, {
      toggleEl,
      onBackgroundClick: () => popup.close(),
      isLibraryElement,
      onEscape: () => {
        if (popup.getOpenId() !== null) {
          popup.close();
        } else {
          disable();
        }
      },
    });

    // Semantic blocking for assistive tech: remove the host from the a11y tree while ON (the layer/
    // popup/markers and the toggle stay reachable). Runs last so the just-mounted library nodes are
    // present and skipped by the initial scan.
    const isLibraryNode = (el) =>
      el === layer ||
      el === popup.root ||
      (!!el.classList && el.classList.contains('help-layer-marker'));
    isolateBackgroundFromAT(state, { toggleEl, isLibraryNode });
  }

  function turnOff() {
    if (state) {
      state.teardownAll();
      state = null;
      popup = null;
      markers = null;
    }
  }

  function enable() {
    if (state) {
      return;
    }
    turnOn();
    safeInvoke('onEnable', onEnable);
  }

  function disable() {
    if (!state) {
      return;
    }
    turnOff();
    safeInvoke('onDisable', onDisable);
  }

  function toggleMode() {
    if (state) {
      disable();
    } else {
      enable();
    }
  }

  // Open the description for a given key programmatically. When OFF, first enable() to create the markers.
  function openByKey(key) {
    if (!state) {
      enable();
    }
    if (!markers || !popup) {
      return;
    }
    const entries = markers.markersForKey(key);
    if (entries.length === 0) {
      if (!silent) {
        console.warn(`[help-layer] open(): no help marker for key "${key}"`);
      }
      return;
    }
    // Several elements can share the same data-help-id (each gets its own marker). open() can only show
    // one popup, so it opens the first (mount order). Make that choice explicit instead of silent.
    if (entries.length > 1 && !silent) {
      console.warn(
        `[help-layer] open("${key}"): ${entries.length} elements share ${attribute}="${key}"; opening the first. ` +
        'Give each a unique id (or use a free-placement key) to target a specific one.',
      );
    }
    const entry = entries[0];
    popup.open(entry.record, entry.el);
    safeInvoke('onOpen', onOpen, entry.record);
  }

  // Close the open description (does not turn the mode itself OFF).
  function closePopup() {
    if (popup) {
      popup.close();
    }
  }

  // Replace the helpConfig. If ON, rebuild silently (onEnable/onDisable are not fired).
  function update(newConfig) {
    validateConfig(newConfig);
    activeConfig = newConfig;
    if (state) {
      turnOff();
      turnOn();
    }
  }

  // Developer aid: scan the live DOM and report how the current config maps onto it (logs + returns).
  // Reads activeConfig via closure so it reflects update(), and works whether the mode is ON or OFF.
  function diagnose() {
    const report = buildRuntimeReport(activeConfig, { attribute });
    formatRuntimeReport(report);
    return report;
  }

  if (toggleEl) {
    toggleEl.addEventListener('click', toggleMode);
  }

  // With debug:true, expose diagnose() on window so it can be called straight from the devtools
  // console without holding the controller reference. Cast to a loose type since this is an ad-hoc
  // global not declared on the Window interface.
  const globalScope = typeof window !== 'undefined' ? /** @type {any} */ (window) : null;
  if (debug && globalScope) {
    globalScope.helpLayerDiagnose = diagnose;
  }

  return {
    enable,
    disable,
    toggle: toggleMode,
    isActive() {
      return state !== null;
    },
    open: openByKey,
    close: closePopup,
    update,
    diagnose,
    destroy() {
      disable();
      if (toggleEl) {
        toggleEl.removeEventListener('click', toggleMode);
      }
      // Only retract the global we installed — never clobber another instance's handler.
      if (debug && globalScope && globalScope.helpLayerDiagnose === diagnose) {
        delete globalScope.helpLayerDiagnose;
      }
    },
  };
}
