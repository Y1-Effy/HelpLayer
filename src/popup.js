/**
 * The single popup shared across the whole library.
 * Placed on its target (the clicked marker) with Floating UI; at screen edges, flip/shift avoid
 * clipping. While visible it follows via autoUpdate.
 *
 * Accessibility:
 * - On open, move focus to the popup (role=dialog).
 * - On close, return focus to the trigger element (the marker).
 */
import { createPopup } from './dom-builder.js';
import { anchorPopup } from './floating.js';

/**
 * @param {object} state teardown registry
 * @param {object} [options]
 * @param {() => void} [options.onClose] called when the popup closes (transitions from shown to hidden)
 * @param {(record: import('./matcher.js').HelpRecord) => (Node|null|undefined)} [options.render]
 *   Escape hatch to render the body area with your own DOM node. Return a Node to display it;
 *   if nothing is returned, fall back to safe text rendering (textContent). The title is always record.title.
 *   Note: the return value is appendChild'd as-is without sanitization, so untrusted data must be neutralized by the caller.
 * @param {import('@floating-ui/dom').Placement} [options.popupPlacement] initial placement (default 'bottom-start')
 */
export function createPopupController(state, { onClose, render, popupPlacement = 'bottom-start' } = {}) {
  const { root, titleEl, textEl, closeEl } = createPopup();
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

  /**
   * @param {import('./matcher.js').HelpRecord} record
   * @param {HTMLElement} referenceEl placement reference (the clicked marker element)
   */
  function open(record, referenceEl) {
    titleEl.textContent = record.title;
    // If render exists, replace the body with a custom Node; otherwise fall back to safe text rendering.
    const custom = render ? render(record) : null;
    textEl.textContent = '';
    if (custom) {
      textEl.appendChild(custom);
    } else {
      textEl.textContent = record.text;
    }
    root.style.display = 'block';
    openId = record.id;
    triggerEl = referenceEl;

    stopAnchor();
    anchor = anchorPopup(referenceEl, root, popupPlacement);

    // preventScroll: the popup is positioned asynchronously (computePosition().then), so at this
    // point it's still at its stale position; a default focus would scroll toward that, causing a
    // visible jump. flip/shift keep it in the viewport, so suppressing the scroll is safe.
    root.focus({ preventScroll: true });
  }

  // Reposition immediately, only when open.
  // (Called e.g. right after a marker shifts due to the overlap-avoidance transform.)
  function reposition() {
    if (anchor) {
      anchor.update();
    }
  }

  function hide() {
    // Call onClose only if it was open (catches both the close-path and teardown-path close routes at one point).
    const wasOpen = openId !== null;
    stopAnchor();
    openId = null;
    triggerEl = null;
    root.style.display = 'none';
    if (wasOpen && onClose) {
      onClose();
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
