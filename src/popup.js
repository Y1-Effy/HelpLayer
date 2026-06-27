/**
 * The single popup shared across the whole library.
 * Placed on its target (the clicked marker) via the positioning seam (anchorPopup in floating.js);
 * at screen edges, flip/shift avoid clipping. While visible it follows the marker per animation frame.
 *
 * Accessibility:
 * - On open, move focus to the popup (role=dialog).
 * - On close, return focus to the trigger element (the marker).
 */
import { createPopup } from './dom-builder.js';
import { anchorPopup } from './floating.js';
import { safeInvoke } from './safe.js';

/**
 * @param {object} state teardown registry
 * @param {object} [options]
 * @param {() => void} [options.onClose] called when the popup closes (transitions from shown to hidden)
 * @param {(record: import('./matcher.js').HelpRecord) => (Node|null|undefined)} [options.render]
 *   Escape hatch to render the body area with your own DOM node. Return a Node to display it;
 *   if nothing is returned, fall back to safe text rendering (textContent). The title is always record.title.
 *   Note: the return value is appendChild'd as-is without sanitization, so untrusted data must be neutralized by the caller.
 * @param {import('./types.js').Placement} [options.popupPlacement] initial placement (default 'bottom-start')
 */
export function createPopupController(state, { onClose, render, popupPlacement = 'bottom-start' } = {}) {
  const { root, titleEl, textEl, closeEl } = createPopup();
  // Drive the open/close state with an inline !important display so it beats both this library's own
  // stylesheet and any host rule (e.g. div { display:none !important }). Start hidden.
  root.style.setProperty('display', 'none', 'important');
  document.body.appendChild(root);

  // The close (×) button. root is removed on teardown, so explicitly detaching the listener isn't needed.
  closeEl.addEventListener('click', () => close());

  let openId = null;
  let triggerEl = null;
  let anchor = null;

  function stopAnchor() {
    if (anchor) {
      anchor.cleanup();
      anchor = null;
    }
  }

  // Focus trap. aria-modal="true" promises AT that the rest of the page is inert, but keyboard Tab
  // would still escape to the markers/toggle behind the popup (they're "library elements", so the
  // blocking layer lets their keys through). Keep Tab cycling inside the dialog to match the promise.
  const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  function trapTab(event) {
    if (event.key !== 'Tab') {
      return;
    }
    // Recompute every keypress: a custom render() can add its own focusables to the body. We don't
    // filter by layout visibility here — the popup's contents are controlled (a close button plus
    // whatever render returns), and a layout probe (offsetParent/getClientRects) is unreliable anyway.
    const focusable = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el instanceof HTMLElement);
    event.preventDefault();
    if (focusable.length === 0) {
      // Nothing focusable inside: hold focus on the dialog itself rather than letting it escape.
      root.focus({ preventScroll: true });
      return;
    }
    const count = focusable.length;
    const index = focusable.indexOf(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    // Step in the requested direction, wrapping at both ends. When focus is on the dialog root
    // (index -1), Tab starts at the first element and Shift+Tab at the last.
    const next = index === -1
      ? (event.shiftKey ? focusable[count - 1] : focusable[0])
      : focusable[(index + (event.shiftKey ? -1 : 1) + count) % count];
    next.focus({ preventScroll: true });
  }

  /**
   * @param {import('./matcher.js').HelpRecord} record
   * @param {HTMLElement} referenceEl placement reference (the clicked marker element)
   */
  function open(record, referenceEl) {
    // Switching straight from one marker's popup to another's is a close of the previous followed by an
    // open of the new one, so emit onClose for the previous to keep open/close callbacks balanced
    // (analytics rely on the pairing). We deliberately don't run the full hide() here — no DOM hide and
    // no focus return — because the popup stays shown and merely re-points at the new reference.
    if (openId !== null && openId !== record.id) {
      safeInvoke('onClose', onClose);
    }
    titleEl.textContent = record.title;
    // If render exists, replace the body with a custom Node; otherwise fall back to safe text rendering.
    // A throwing render yields undefined here, so we degrade to the safe textContent path below.
    const custom = safeInvoke('render', render, record);
    textEl.textContent = '';
    if (custom) {
      textEl.appendChild(custom);
    } else {
      textEl.textContent = record.text;
    }
    root.style.setProperty('display', 'block', 'important');
    openId = record.id;
    triggerEl = referenceEl;

    stopAnchor();
    anchor = anchorPopup(referenceEl, root, popupPlacement);

    // Keep Tab inside the dialog while it's open (removed in hide()). Capture phase so it runs before
    // any focusable's own keydown can act on the Tab.
    root.addEventListener('keydown', trapTab, true);

    // preventScroll: anchorPopup positions the popup synchronously above, so it's already in place,
    // but focusing it can still nudge an ancestor scroll container toward it; flip/shift keep it in
    // the viewport, so suppressing that scroll is safe and avoids a visible jump.
    root.focus({ preventScroll: true });
  }

  // Reposition immediately, only when open.
  // (Called e.g. right after a marker's left/top shifts from the overlap-avoidance pass.)
  function reposition() {
    if (anchor) {
      anchor.update();
    }
  }

  function hide() {
    // Call onClose only if it was open (catches both the close-path and teardown-path close routes at one point).
    const wasOpen = openId !== null;
    stopAnchor();
    root.removeEventListener('keydown', trapTab, true);
    openId = null;
    triggerEl = null;
    root.style.setProperty('display', 'none', 'important');
    if (wasOpen) {
      safeInvoke('onClose', onClose);
    }
  }

  /**
   * Close and return focus.
   * @param {HTMLElement} [focusTarget] explicit focus-return target.
   *   If omitted, returns to the trigger element (the marker). In contexts where the trigger
   *   disappears (SPA removal), pass another surviving element such as the toggle.
   */
  function close(focusTarget) {
    const returnTo = focusTarget ?? triggerEl;
    hide();
    // Return focus if the target is still in the DOM.
    if (returnTo && returnTo.isConnected && typeof returnTo.focus === 'function') {
      returnTo.focus({ preventScroll: true });
    }
  }

  state.track(() => {
    hide();
    root.remove();
  });

  return {
    root,
    isOpen(id) {
      return openId === id;
    },
    getOpenId() {
      return openId;
    },
    open,
    close,
    reposition,
  };
}
