/**
 * Default positioning backend — dependency-free (no Floating UI).
 *
 * Markers position themselves in markers.js; this module only handles the single shared popup and the
 * blocking layer's toggle-following clip-path. It re-implements the small slice of Floating UI the
 * library used: place-on-a-side + offset + flip + shift (see computePopupPosition in geometry.js), and
 * an autoUpdate-style tracker (track) built on the same per-frame rAF pattern markers.js uses.
 *
 * The reference helpers (isFixedReference / isReferenceHidden / makeVirtualElement) live in
 * reference.js and are re-exported so this backend and floating.floatingui.js have an identical
 * surface — the two are interchangeable via the one-line seam in floating.js.
 */
import { computePopupPosition, viewportToAbsolute } from './geometry.js';
import { isFixedReference, isReferenceHidden, makeVirtualElement } from './reference.js';

export { isFixedReference, isReferenceHidden, makeVirtualElement };

function place(el, x, y) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function sameRect(a, b) {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Keep calling onChange while the reference moves/resizes: once synchronously now (like Floating UI's
 * initial autoUpdate run), then on every animation frame in which the reference's rect changed. The
 * popup's reference is the marker, which markers.js moves per frame, so per-frame tracking keeps the
 * popup glued; an unchanged rect costs only one getBoundingClientRect and no work.
 * @param {Element|object} reference
 * @param {() => void} onChange
 * @returns {() => void} cleanup
 */
function track(reference, onChange) {
  onChange(); // initial placement, synchronous
  let prev = reference.getBoundingClientRect();
  let stopped = false;
  let frame = requestAnimationFrame(function loop() {
    if (stopped) {
      return;
    }
    const rect = reference.getBoundingClientRect();
    if (!sameRect(rect, prev)) {
      onChange();
    }
    prev = rect;
    frame = requestAnimationFrame(loop);
  });
  // A viewport resize can change the popup's flip/shift even when the reference itself doesn't move
  // (e.g. a popup shifted near the right edge while its marker stays put). The rect-change loop above
  // wouldn't catch that, so listen for resize explicitly — matching the Floating UI backend, whose
  // autoUpdate also reacts to ancestor/window resize.
  const onResize = () => onChange();
  window.addEventListener('resize', onResize);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
  };
}

/**
 * Place the popup on a side of the target with a gap, flipping/shifting at screen edges to stay
 * visible, and keep it following while open.
 * @param {Element|object} reference
 * @param {HTMLElement} popupEl
 * @param {import('./types.js').Placement} [placement] initial placement. Default 'bottom-start'
 * @returns {{ update: () => void, cleanup: () => void }}
 */
export function anchorPopup(reference, popupEl, placement = 'bottom-start') {
  // Match the strategy to the reference: a fixed reference needs a fixed popup or it jitters on
  // scroll. Set it every open so reopening on a normal marker restores absolute. Inline !important
  // beats the stylesheet's `position: absolute !important`.
  const strategy = isFixedReference(reference) ? 'fixed' : 'absolute';
  popupEl.style.setProperty('position', strategy, 'important');

  const update = () => {
    const refRect = reference.getBoundingClientRect();
    const popupSize = { width: popupEl.offsetWidth, height: popupEl.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { left, top } = computePopupPosition(refRect, popupSize, viewport, { placement });
    if (strategy === 'fixed') {
      place(popupEl, left, top); // fixed: viewport coordinates are used as-is
    } else {
      // absolute: convert viewport coords to body-relative (same scroll-invariant trick as markers).
      const body = document.body;
      const abs = viewportToAbsolute(left, top, body.getBoundingClientRect(), body.clientLeft, body.clientTop);
      place(popupEl, abs.left, abs.top);
    }
  };

  const cleanup = track(reference, update);
  return { update, cleanup };
}

/**
 * Watch a reference element's position/size changes and call onUpdate on every change.
 * (Used to keep the blocking layer's clip-path hole following the toggle.) floatingEl is accepted for
 * signature parity with the Floating UI backend but isn't used here.
 * @param {Element} referenceEl
 * @param {HTMLElement} _floatingEl unused (kept for backend parity)
 * @param {() => void} onUpdate
 * @returns {() => void} cleanup
 */
export function watchReference(referenceEl, _floatingEl, onUpdate) {
  return track(referenceEl, onUpdate);
}
