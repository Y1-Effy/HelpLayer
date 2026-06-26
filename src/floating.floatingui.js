/**
 * Alternate positioning backend built on Floating UI (@floating-ui/dom).
 *
 * This is the original implementation, kept verbatim so the library can switch back to Floating UI at
 * any time. To revert:
 *   1. in floating.js, change the re-export to `export * from './floating.floatingui.js';`
 *   2. move `@floating-ui/dom` from devDependencies back to dependencies
 *   3. restore the `@floating-ui/*` entries in the demo import maps (demo/index.html, demo/stress.html)
 * The default backend is the dependency-free ./floating.self.js. The reference helpers
 * (isFixedReference / isReferenceHidden / makeVirtualElement) are shared via ./reference.js, so both
 * backends expose an identical public surface.
 *
 * Floating UI in a nutshell:
 * - computePosition(reference, floating, options) returns the optimal (x,y) for "this moment".
 * - autoUpdate(reference, floating, update) re-runs update on scroll/resize/element-size changes
 *   (internally via ResizeObserver, etc.); the returned cleanup stops watching.
 */
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

import { isFixedReference, isReferenceHidden, makeVirtualElement } from './reference.js';

// Re-export the shared reference helpers so this backend's surface matches floating.self.js exactly.
export { isFixedReference, isReferenceHidden, makeVirtualElement };

function place(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

/**
 * Place the popup below the target, and at screen edges use flip / shift to avoid clipping.
 * @param {Element|object} reference
 * @param {HTMLElement} popupEl
 * @param {import('./types.js').Placement} [placement] initial placement. Default 'bottom-start'
 * @returns {{ update: () => void, cleanup: () => void }}
 */
export function anchorPopup(reference, popupEl, placement = 'bottom-start') {
  // The reference is the clicked marker. If it's fixed (anchored to a fixed target), the popup must be
  // fixed too or it jitters on scroll. Set position every open so reopening on a normal marker restores
  // absolute. Inline !important beats the stylesheet's `position: absolute !important`.
  const strategy = isFixedReference(reference) ? 'fixed' : 'absolute';
  popupEl.style.setProperty('position', strategy, 'important');
  const update = () => {
    computePosition(reference, popupEl, {
      placement,
      strategy,
      middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      place(popupEl, x, y);
    // Swallow per-frame rejections so a stray rejection doesn't reach the host's unhandledrejection
    // handler (e.g. Sentry); this runs every animation frame, so logging would also flood the console.
    }).catch(() => {});
  };
  // animationFrame: true so the popup tracks smoothly: its reference is the marker element, which the
  // markers.js loop moves per frame, so the popup must re-evaluate per frame to stay glued.
  const cleanup = autoUpdate(reference, popupEl, update, { animationFrame: true });
  return { update, cleanup };
}

/**
 * Watch a reference element's position/size changes and call onUpdate on every change.
 * (Used to keep the blocking layer's clip-path hole following the toggle.) autoUpdate requires a
 * floating element, so floatingEl is passed as a dummy that onUpdate doesn't actually position.
 * @param {Element} referenceEl
 * @param {HTMLElement} floatingEl
 * @param {() => void} onUpdate
 * @returns {() => void} cleanup
 */
export function watchReference(referenceEl, floatingEl, onUpdate) {
  return autoUpdate(referenceEl, floatingEl, onUpdate);
}
