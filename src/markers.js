/**
 * Marker manager.
 * Markers can be dynamically mounted/unmounted per help record (SPA dynamic-element support).
 *
 * Positioning runs in ONE shared requestAnimationFrame loop owned by the manager (not one Floating UI
 * autoUpdate per marker). Each frame the loop:
 *   1. reads every visible marker's reference rect (and the shared offsetParent geometry) once,
 *   2. computes each marker's corner-overlap position synchronously (markers only need an offset,
 *      never flip/shift — those are popup-only), runs overlap avoidance on the centers, and
 *   3. writes left/top in a single batched pass.
 * Folding tracking + overlap into one read-then-write loop avoids the layout thrashing and the
 * doubled rect reads of running N independent animation-frame loops, which is what made large marker
 * counts expensive. Smoothness is unchanged: writes still happen every frame before paint.
 *
 * Marker identifier (id):
 * - element-bound: the target element itself (distinguishes multiple elements with the same data-help-id)
 * - free placement: the config key string
 */
import { createMarker } from './dom-builder.js';
import { isFixedReference, isReferenceHidden, makeVirtualElement } from './floating.js';
import { markerViewportTopLeft, viewportToAbsolute } from './geometry.js';
import { resolveOverlaps } from './overlap.js';

// Temporary class added to the target element only while the marker is hovered/focused (matches the style.js definition).
const TARGET_HIGHLIGHT_CLASS = 'help-layer-target-highlight';

// Fallback marker size if the real size can't be measured yet (matches the CSS default). Used only
// until a laid-out marker reports a non-zero offsetWidth, which is then cached.
const DEFAULT_MARKER_SIZE = 24;

/** @param {import('./matcher.js').HelpRecord} record */
function referenceFor(record) {
  if (record.kind === 'free') {
    return makeVirtualElement(() => ({
      top: record.position.top,
      left: record.position.left,
      width: 0,
      height: 0,
    }));
  }
  return record.target;
}

/**
 * @param {object} state teardown registry
 * @param {object} options
 * @param {(record: import('./matcher.js').HelpRecord, markerEl: HTMLElement) => void} options.onMarkerClick
 * @param {() => void} [options.onOverlapResolved] called once per frame in which any marker actually moved
 * @param {(record: import('./matcher.js').HelpRecord) => void} [options.onMarkerHidden] called when a
 *   marker's target transitions to hidden (e.g. display:none) — lets the caller close a popup open on it
 * @param {string} [options.markerLabel] character shown on the marker (default '?')
 * @param {import('./types.js').Placement} [options.markerPlacement] corner to overlap (default 'top-end')
 */
export function createMarkerManager(state, {
  onMarkerClick,
  onOverlapResolved,
  onMarkerHidden,
  markerLabel = '?',
  markerPlacement = 'top-end',
}) {
  /**
   * @typedef {object} MarkerEntry
   * @property {import('./matcher.js').HelpRecord} record
   * @property {HTMLElement} el
   * @property {Element|object} reference positioning reference (element or virtual element)
   * @property {'fixed'|'absolute'} strategy positioning strategy chosen from the reference
   * @property {import('./types.js').Placement} placement corner to overlap onto
   * @property {() => void} cleanup
   * @property {boolean} hidden whether the target is currently reported hidden (edge tracking for onMarkerHidden)
   * @property {DOMRect=} refRect the reference rect read during the current frame's read phase
   * @property {{left:number,top:number}|null} lastBaseEl previous frame's pre-overlap position (element space) — movement detection
   * @property {number|undefined} lastLeft last written left (px), to skip redundant DOM writes
   * @property {number|undefined} lastTop last written top (px)
   */
  /** @type {Map<Element|string, MarkerEntry>} */
  const markers = new Map();
  let rafId = null;
  // Don't schedule a new rAF during teardown (prevents a frame lingering after teardown).
  let tornDown = false;
  // Cached marker size (square). Measured once from a laid-out marker; 0 until then.
  let markerSize = 0;
  // Visible-marker count from the previous frame, to detect membership changes (a marker entering or
  // leaving the visible set means overlap must be recomputed even if no surviving marker's base moved).
  let prevVisibleCount = -1;

  // One positioning pass: read references + offsetParent once, compute corner placements + overlap,
  // then write left/top in a batch. Pure of scheduling so it can run either synchronously (initial
  // placement, to avoid a one-frame flash at 0,0) or from the continuous rAF loop (tracking).
  function positionAll() {
    if (tornDown || markers.size === 0) {
      return;
    }

    // --- Read phase: visibility edges + reference rects, plus the shared offsetParent geometry. ---
    const bodyRect = document.body.getBoundingClientRect();
    const bodyClientLeft = document.body.clientLeft;
    const bodyClientTop = document.body.clientTop;

    /** @type {MarkerEntry[]} */
    const visible = [];
    for (const entry of markers.values()) {
      if (isReferenceHidden(entry.reference)) {
        // Target went hidden (e.g. display:none). Hide the marker too instead of leaving it stranded
        // (a display:none target measures 0x0, which would otherwise fling the marker to 0,0). Inline
        // !important beats the stylesheet's `display:block !important`. Fire onMarkerHidden only on the
        // visible -> hidden edge (e.g. to close a popup open on this marker).
        if (!entry.hidden) {
          entry.hidden = true;
          entry.lastBaseEl = null; // force a fresh placement when it reshows
          entry.el.style.setProperty('display', 'none', 'important');
          if (onMarkerHidden) {
            onMarkerHidden(entry.record);
          }
        }
        continue;
      }
      if (entry.hidden) {
        entry.hidden = false;
        entry.el.style.removeProperty('display'); // back to the stylesheet's display:block
      }
      entry.refRect = entry.reference.getBoundingClientRect();
      visible.push(entry);
    }

    // Cache the marker size once a real measurement is available (custom --help-layer-marker-size honored).
    if (!markerSize && visible.length) {
      const measured = visible[0].el.offsetWidth;
      if (measured > 0) {
        markerSize = measured;
      }
    }
    const size = markerSize || DEFAULT_MARKER_SIZE;

    // --- Compute phase (no DOM): base positions, movement/membership detection, overlap offsets. ---
    let dirty = visible.length !== prevVisibleCount;
    prevVisibleCount = visible.length;
    /** @type {{left:number,top:number}[]} */
    const bases = [];
    /** @type {{x:number,y:number}[]} */
    const centers = [];
    for (const entry of visible) {
      const bv = markerViewportTopLeft(entry.refRect, size, entry.placement);
      centers.push({ x: bv.left + size / 2, y: bv.top + size / 2 });
      // Convert the viewport position to what we actually write. For absolute markers this is
      // scroll-invariant (refRect and bodyRect both shift with scroll), so plain page scroll produces
      // no write — the marker rides the document for free. A write happens only when the target really
      // moves relative to the document (layout, resize, animation).
      const be = entry.strategy === 'fixed'
        ? { left: bv.left, top: bv.top }
        : viewportToAbsolute(bv.left, bv.top, bodyRect, bodyClientLeft, bodyClientTop);
      bases.push(be);
      if (!entry.lastBaseEl || entry.lastBaseEl.left !== be.left || entry.lastBaseEl.top !== be.top) {
        dirty = true;
      }
      entry.lastBaseEl = be;
    }

    // --- Write phase: only when something changed, and only the markers whose position differs. ---
    if (dirty && visible.length) {
      const offsets = resolveOverlaps(centers);
      let moved = false;
      for (let i = 0; i < visible.length; i++) {
        const entry = visible[i];
        const left = bases[i].left + offsets[i].dx;
        const top = bases[i].top + offsets[i].dy;
        if (entry.lastLeft !== left || entry.lastTop !== top) {
          entry.el.style.left = `${left}px`;
          entry.el.style.top = `${top}px`;
          entry.lastLeft = left;
          entry.lastTop = top;
          moved = true;
        }
      }
      // Marker positions moved, so give an open popup etc. the chance to follow.
      if (moved && onOverlapResolved) {
        onOverlapResolved();
      }
    }
  }

  // Continuous tracking: position every frame, then re-schedule. Stops re-scheduling once there are no
  // markers left (or after teardown); ensureLoop() restarts it on the next mount.
  function frameTick() {
    rafId = null;
    if (tornDown || markers.size === 0) {
      return;
    }
    positionAll();
    rafId = requestAnimationFrame(frameTick);
  }

  function ensureLoop() {
    if (rafId !== null || tornDown || markers.size === 0) {
      return;
    }
    rafId = requestAnimationFrame(frameTick);
  }

  /** @param {import('./matcher.js').HelpRecord} record */
  function mount(record) {
    if (markers.has(record.id)) {
      return;
    }

    const el = createMarker(record.title, markerLabel);
    document.body.appendChild(el);

    const handleClick = () => onMarkerClick(record, el);
    el.addEventListener('click', handleClick);

    const reference = referenceFor(record);
    // Match the strategy to the reference: a fixed reference needs a fixed marker, or it scrolls with
    // the document while the fixed target stays put and visibly drifts (see isFixedReference). Inline
    // !important beats the stylesheet's `position: absolute !important`.
    const strategy = isFixedReference(reference) ? 'fixed' : 'absolute';
    if (strategy === 'fixed') {
      el.style.setProperty('position', 'fixed', 'important');
    }

    // Target-element highlight (element-bound only; free placement has no target, so skip).
    // Show an outline on the target only while the marker is hovered/focused, to make clear "which element this explains".
    const target = record.kind === 'element' ? record.target : null;
    const addHighlight = () => target && target.classList.add(TARGET_HIGHLIGHT_CLASS);
    const removeHighlight = () => target && target.classList.remove(TARGET_HIGHLIGHT_CLASS);
    if (target) {
      el.addEventListener('mouseenter', addHighlight);
      el.addEventListener('mouseleave', removeHighlight);
      el.addEventListener('focus', addHighlight);
      el.addEventListener('blur', removeHighlight);
    }

    let done = false;
    const cleanup = () => {
      if (done) {
        return;
      }
      done = true;
      el.removeEventListener('click', handleClick);
      if (target) {
        el.removeEventListener('mouseenter', addHighlight);
        el.removeEventListener('mouseleave', removeHighlight);
        el.removeEventListener('focus', addHighlight);
        el.removeEventListener('blur', removeHighlight);
        removeHighlight(); // don't leave the highlight on the target if unmounted while highlighted
      }
      el.remove();
      markers.delete(record.id);
      ensureLoop(); // keep the loop alive so the next frame re-packs the remaining markers
    };

    markers.set(record.id, {
      record,
      el,
      reference,
      strategy,
      placement: markerPlacement,
      cleanup,
      hidden: false,
      lastBaseEl: null,
      lastLeft: undefined,
      lastTop: undefined,
    });
    ensureLoop();
  }

  function unmount(id) {
    const entry = markers.get(id);
    if (entry) {
      entry.cleanup();
    }
  }

  function mountAll(records) {
    records.forEach(mount);
    // Place the whole batch synchronously (before paint) so markers don't flash at (0,0) for a frame
    // on enable; the rAF loop started by mount() then takes over tracking. Done once per batch (not
    // per mount) to keep this O(n), not O(n^2).
    positionAll();
  }

  // Register a single teardown for the whole manager with state
  // (individual mount/unmount happen many times during a session, so they're bundled here).
  state.track(() => {
    tornDown = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    [...markers.values()].forEach((entry) => entry.cleanup());
  });

  return {
    mount,
    unmount,
    mountAll,
    has(id) {
      return markers.has(id);
    },
    // Return every entry matching the config key, in mount order. Free placement keys are unique so this
    // is at most one; element-bound keys can repeat (several elements sharing the same data-help-id), so
    // the caller (programmatic open(key)) sees the multiplicity and can warn that it opens the first.
    markersForKey(key) {
      const matches = [];
      for (const entry of markers.values()) {
        if (entry.record.key === key) {
          matches.push(entry);
        }
      }
      return matches;
    },
  };
}
