/**
 * Transparent interaction-blocking layer.
 *
 * Without touching the original app's event listeners at all, it keeps interactions from getting through. How it works:
 *
 * 1. Let the toggle show through via a clip-path "hole":
 *    Set a clip-path polygon on the full-screen layer made of the outer rectangle + the toggle
 *    rectangle (the hole). Inside the hole the layer isn't painted and hit-testing passes through,
 *    so the toggle can be clicked natively without touching z-index at all. Unlike approaches that
 *    shuffle z-index, this doesn't break depending on ancestor stacking contexts.
 *    The hole is updated via autoUpdate to follow the toggle's scroll/resize.
 *
 * 2. Focus containment:
 *    On ON, blur activeElement, and via focusin (capture) detect focus moving to anything other
 *    than the library UI and pull it back to the toggle. Host listeners are not detached.
 *
 * 3. Key-input suppression:
 *    Capture keydown/keyup in document's capture phase; for anything outside the library UI,
 *    stopPropagation+preventDefault. Escape has dedicated handling (close popup / exit mode).
 *    Inside the library UI (marker/popup/toggle), normal interactions like Tab are allowed.
 */
import { createBlockingLayer } from './dom-builder.js';
import { watchReference } from './floating.js';

function buildClipPath(rect) {
  const x1 = rect.left;
  const y1 = rect.top;
  const x2 = rect.right;
  const y2 = rect.bottom;
  // A single stroke: outer ring (clockwise) -> bridge -> toggle rectangle (counter-clockwise).
  // Under the nonzero winding rule, making the inner ring wind opposite to the outer one punches a hole.
  return `polygon(
    0px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 0px,
    ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
  )`;
}

export function activateBlockingLayer(state, {
  toggleEl,
  onBackgroundClick,
  isLibraryElement,
  onEscape,
}) {
  const layer = createBlockingLayer();
  document.body.appendChild(layer);
  state.track(() => layer.remove());

  // --- 1. Keep the clip-path hole following the toggle position ---
  // If there's no toggle element (programmatic control only), keeping the whole surface blocked with no hole is correct.
  if (toggleEl) {
    const updateClip = () => {
      layer.style.clipPath = buildClipPath(toggleEl.getBoundingClientRect());
    };
    const cleanupClipWatch = watchReference(toggleEl, layer, updateClip);
    state.track(cleanupClipWatch);
  }

  // Clicking the background (the layer itself) closes the popup
  if (onBackgroundClick) {
    layer.addEventListener('click', onBackgroundClick);
    state.track(() => layer.removeEventListener('click', onBackgroundClick));
  }

  // --- 2. Focus containment ---
  // Turning ON happens via a click on the toggle, so don't blur if the active element is the toggle
  // itself (blurring would leave focus floating). For any other host element, make it let go.
  const activeEl = document.activeElement;
  if (
    activeEl instanceof HTMLElement &&
    activeEl !== document.body &&
    activeEl !== toggleEl
  ) {
    activeEl.blur();
  }

  const handleFocusIn = (event) => {
    if (isLibraryElement(event.target)) {
      return;
    }
    // If focus tries to move to a host element, take it back.
    // To the toggle if there is one; otherwise blur that element so it isn't handed to the host.
    event.stopPropagation();
    if (toggleEl) {
      toggleEl.focus({ preventScroll: true });
    } else if (event.target instanceof HTMLElement) {
      event.target.blur();
    }
  };
  document.addEventListener('focusin', handleFocusIn, true);
  state.track(() => document.removeEventListener('focusin', handleFocusIn, true));

  // --- 3. Key-input suppression + Escape ---
  // Shared logic that doesn't pass key input destined outside the library UI through to the host.
  const blockNonLibrary = (event) => {
    if (isLibraryElement(event.target)) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
  };
  // keyup / keypress: don't leak to the host, Escape included (Escape's real handling is on the keydown side).
  const blockKey = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    blockNonLibrary(event);
  };
  const handleKeydown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      if (onEscape) {
        onEscape();
      }
      return;
    }
    blockNonLibrary(event);
  };
  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('keyup', blockKey, true);
  document.addEventListener('keypress', blockKey, true);
  state.track(() => {
    document.removeEventListener('keydown', handleKeydown, true);
    document.removeEventListener('keyup', blockKey, true);
    document.removeEventListener('keypress', blockKey, true);
  });

  return layer;
}
