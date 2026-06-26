/**
 * Backend-agnostic helpers about a positioning "reference" (the element a marker/popup points at,
 * or a virtual element for free placements). These touch only the DOM — no positioning library — so
 * both the self-implemented and the Floating UI positioning backends share them unchanged.
 */
import { docRectToViewportRect } from './geometry.js';

/**
 * Create a "virtual reference element" for free-placement items not bound to an element.
 * getDocRect() returns document coordinates; this converts them to viewport coordinates for the
 * current scroll, so the element tracks the page as it scrolls (it's re-read every frame).
 * @param {() => {top:number,left:number,width?:number,height?:number}} getDocRect
 */
export function makeVirtualElement(getDocRect) {
  return {
    // Kept for parity with the Floating UI backend (its autoUpdate uses contextElement to know which
    // scroll ancestors to watch). Harmless for the self backend, which reads the rect directly.
    contextElement: document.body,
    getBoundingClientRect() {
      return docRectToViewportRect(getDocRect(), { x: window.scrollX, y: window.scrollY });
    },
  };
}

/**
 * Whether the reference lives in a `position: fixed` subtree. Such a reference stays put in the
 * viewport while the page scrolls, so an absolutely-positioned floating element (which scrolls with
 * the document) would drift; for these we switch the floating element to a fixed strategy so both
 * live in the same viewport space and stay glued without per-frame correction.
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

/**
 * Whether a reference element is currently not rendered (hidden). Free placements use a virtual
 * element with no host node, so they are never "hidden" (return false).
 * @param {Element|object} reference
 */
export function isReferenceHidden(reference) {
  if (!(reference instanceof Element)) {
    return false;
  }
  // checkVisibility() catches display:none (incl. an ancestor), content-visibility, and—with the
  // option—visibility:hidden, in one cheap call without any extra observers. NOTE: do NOT use
  // offsetParent here; it is null for position:fixed elements too (which this lib supports as
  // targets) and would wrongly hide their markers. Engines without checkVisibility fall back to the
  // rect: a display:none element measures 0x0 (the worst case — the marker would jump to 0,0).
  if (typeof reference.checkVisibility === 'function') {
    return !reference.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
  }
  const r = reference.getBoundingClientRect();
  return r.width === 0 && r.height === 0;
}
