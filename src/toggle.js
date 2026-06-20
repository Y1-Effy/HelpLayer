/**
 * Orchestration of the help mode's ON/OFF.
 * Starts each subsystem (style injection, marker manager, popup, blocking layer, DOM observation)
 * and aggregates their teardown into the cleanup registry (state).
 */
import { activateBlockingLayer } from './blocking-layer.js';
import { normalizeConfig, validateConfig } from './config.js';
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
import { createState } from './state.js';
import { injectStyles, removeStyles } from './style.js';

function resolveToggleElement(toggle) {
  const toggleEl = typeof toggle === 'string' ? document.querySelector(toggle) : toggle;
  if (!toggleEl) {
    throw new Error(`help-layer: toggle element not found for selector "${toggle}"`);
  }
  return toggleEl;
}

/**
 * @param {object} params
 * @param {object} params.config helpConfig
 * @param {string|HTMLElement} [params.toggle] DOM element that switches ON/OFF (if omitted, programmatic control only)
 * @param {() => void} [params.onEnable] called right after the mode is turned ON
 * @param {() => void} [params.onDisable] called right after the mode is turned OFF
 * @param {(record: import('./matcher.js').HelpRecord) => void} [params.onOpen] called when a popup is opened
 * @param {() => void} [params.onClose] called when a popup is closed
 * @param {boolean} [params.silent] suppress the warning log for unregistered keys
 * @param {string} [params.attribute] attribute name marking targets (default 'data-help-id')
 * @param {(record: import('./matcher.js').HelpRecord) => (Node|null|undefined)} [params.render] render the popup body with your own Node
 *   (the return value is inserted as-is without sanitization, so untrusted data must be neutralized by the caller)
 * @param {string} [params.markerLabel] character shown on the marker (default '?')
 * @param {import('@floating-ui/dom').Placement} [params.markerPlacement] corner to overlap the marker onto (default 'top-end')
 * @param {import('@floating-ui/dom').Placement} [params.popupPlacement] initial popup placement (default 'bottom-start')
 * @param {string} [params.nonce] nonce to allow the injected <style> under a strict CSP (style-src 'nonce-…')
 */
export function createToggleController({
  config,
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
}) {
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
        if (onOpen) {
          onOpen(record);
        }
      },
      // When overlap avoidance moves a marker, make the open popup follow.
      onOverlapResolved: () => popup.reposition(),
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

    activateBlockingLayer(state, {
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
    if (onEnable) {
      onEnable();
    }
  }

  function disable() {
    if (!state) {
      return;
    }
    turnOff();
    if (onDisable) {
      onDisable();
    }
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
    const entry = markers.findByKey(key);
    if (!entry) {
      if (!silent) {
        console.warn(`[help-layer] open(): no help marker for key "${key}"`);
      }
      return;
    }
    popup.open(entry.record, entry.el);
    if (onOpen) {
      onOpen(entry.record);
    }
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

  if (toggleEl) {
    toggleEl.addEventListener('click', toggleMode);
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
    destroy() {
      disable();
      if (toggleEl) {
        toggleEl.removeEventListener('click', toggleMode);
      }
    },
  };
}
