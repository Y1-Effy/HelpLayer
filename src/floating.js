/**
 * A thin wrapper around Floating UI (@floating-ui/dom).
 * Use of Floating UI is confined to this one file; other modules only call the
 * purpose-specific functions (anchorMarker / anchorPopup / watchReference /
 * makeVirtualElement). That way, if Floating UI is ever swapped out, the blast
 * radius stays limited to here.
 *
 * Floating UI in a nutshell (note for readers unfamiliar with the DOM):
 * - computePosition(reference, floating, options) computes the optimal placement
 *   coordinates (x,y) for "this exact moment" and returns them (one-shot).
 * - autoUpdate(reference, floating, update) watches scroll, resize, and element-size
 *   changes (internally using ResizeObserver, etc.) and calls update on every change.
 *   Calling the returned cleanup stops watching. This is what makes the element "stick"
 *   to its target.
 */
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

import { docRectToViewportRect } from './geometry.js';

/**
 * Create a "virtual reference element" for free-placement items not bound to an element.
 * When getDocRect() returns document coordinates, this converts them to viewport
 * coordinates according to the current scroll. Because autoUpdate re-evaluates on every
 * scroll, the element sticks to the given coordinate while scrolling along with the page.
 * @param {() => {top:number,left:number,width?:number,height?:number}} getDocRect
 */
export function makeVirtualElement(getDocRect) {
  return {
    // Tell autoUpdate that this element's ancestor is body (= scroll is watched up to window).
    // Without this the virtual element isn't scroll-watched and won't follow page scroll.
    contextElement: document.body,
    getBoundingClientRect() {
      return docRectToViewportRect(getDocRect(), { x: window.scrollX, y: window.scrollY });
    },
  };
}

function place(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

/**
 * Whether the reference lives in a `position: fixed` subtree. Such a reference stays put in the
 * viewport while the page scrolls, so an absolutely-positioned floating element (which scrolls with
 * the document) would have to be re-corrected every frame and visibly jitters. For these we switch the
 * floating element to Floating UI's `fixed` strategy (and position:fixed) so both live in the same
 * viewport space and stay glued without per-frame correction.
 *
 * Virtual elements (free placements) aren't in the DOM and already track scroll via their getRect, so
 * they report false. Walks across shadow boundaries via the host so Shadow DOM targets are handled too.
 * @param {Element|object} reference
 */
export function isFixedReference(reference) {
  if (!(reference instanceof Element)) {
    return false;
  }
  let node = reference;
  while (node) {
    if (getComputedStyle(node).position === 'fixed') {
      return true;
    }
    const parent = node.parentElement;
    if (parent) {
      node = parent;
    } else {
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : null;
    }
  }
  return false;
}

// Half of the default marker size (22px). The amount used to overlap the marker onto the
// target's corner with an "inset". (If the marker-size CSS variable is changed, the resulting
// drift is left as existing behavior = not compensated for here.)
const MARKER_INSET = 11;

/**
 * Derive the offset for overlapping the marker onto the target's corner from the placement.
 * mainAxis is always negative (bites inward past the target's edge). crossAxis flips sign by
 * alignment direction: `-end` (right/bottom-aligned) is negative to go inward, `-start`
 * (left/top-aligned) is positive to go inward.
 * @param {string} placement
 */
function markerOffset(placement) {
  const isStart = placement.endsWith('-start');
  return { mainAxis: -MARKER_INSET, crossAxis: isStart ? MARKER_INSET : -MARKER_INSET };
}

/**
 * Overlap the marker onto a corner of the target (element or virtual element), stick it there, and keep it following.
 * @param {Element|object} reference
 * @param {HTMLElement} markerEl
 * @param {() => void} [onPlaced] called every time placement is finalized (used to trigger the overlap-avoidance pass, etc.)
 * @param {import('@floating-ui/dom').Placement} [placement] corner to overlap (top-end/top-start/bottom-end/bottom-start). Default 'top-end'
 * @returns {() => void} cleanup
 */
export function anchorMarker(reference, markerEl, onPlaced, placement = 'top-end') {
  // Match the floating element's strategy to the reference: a fixed reference needs a fixed marker, or
  // it jitters while scrolling (see isFixedReference). Inline !important beats the stylesheet's
  // `position: absolute !important`.
  const strategy = isFixedReference(reference) ? 'fixed' : 'absolute';
  if (strategy === 'fixed') {
    markerEl.style.setProperty('position', 'fixed', 'important');
  }
  const update = () => {
    computePosition(reference, markerEl, {
      placement,
      strategy,
      middleware: [offset(markerOffset(placement))],
    }).then(({ x, y }) => {
      place(markerEl, x, y);
      if (onPlaced) {
        onPlaced();
      }
    // Swallow silently: this runs every animation frame, so logging would flood the console, and a
    // stray rejection must not surface in the host app's unhandledrejection handler (e.g. Sentry).
    }).catch(() => {});
  };
  // animationFrame: true syncs repositioning to the rAF loop. With the default (scroll/resize
  // events only), computePosition resolves asynchronously, so left/top is written the frame after
  // the browser already painted the scroll — the marker lags a frame and visibly jitters.
  return autoUpdate(reference, markerEl, update, { animationFrame: true });
}

/**
 * Place the popup below the target, and at screen edges use flip (flip to the opposite side) /
 * shift (nudge) to avoid clipping. Only follows while visible.
 * @param {Element|object} reference
 * @param {HTMLElement} popupEl
 * @param {import('@floating-ui/dom').Placement} [placement] initial placement (Floating UI placement). Default 'bottom-start'
 * @returns {{ update: () => void, cleanup: () => void }}
 *   calling update repositions immediately (used for reference-side transform moves that autoUpdate doesn't pick up, etc.).
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
    // Same rationale as anchorMarker: swallow per-frame rejections so they don't reach the host.
    }).catch(() => {});
  };
  // animationFrame: true for the same smooth-tracking reason as anchorMarker. The reference here is
  // the marker element, which itself moves per frame, so the popup must track per frame to stay glued.
  const cleanup = autoUpdate(reference, popupEl, update, { animationFrame: true });
  return { update, cleanup };
}

/**
 * Watch a reference element's position/size changes and call onUpdate on every change.
 * (Used for non-placement purposes, e.g. keeping the blocking layer's clip-path hole following the toggle position.)
 * autoUpdate requires a floating element, so floatingEl is just passed as a dummy that
 * onUpdate doesn't actually position.
 * @param {Element} referenceEl
 * @param {HTMLElement} floatingEl
 * @param {() => void} onUpdate
 * @returns {() => void} cleanup
 */
export function watchReference(referenceEl, floatingEl, onUpdate) {
  return autoUpdate(referenceEl, floatingEl, onUpdate);
}
