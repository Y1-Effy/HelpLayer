/**
 * Marker manager.
 * Markers can be dynamically mounted/unmounted per help record (SPA dynamic-element support).
 * Each marker keeps following its target (an element, or the virtual element of a free placement)
 * via Floating UI's autoUpdate. On every finalized placement it triggers the overlap-avoidance pass,
 * debounced with rAF.
 *
 * Marker identifier (id):
 * - element-bound: the target element itself (distinguishes multiple elements with the same data-help-id)
 * - free placement: the config key string
 */
import { createMarker } from './dom-builder.js';
import { anchorMarker, makeVirtualElement } from './floating.js';
import { resolveOverlaps } from './overlap.js';

// Temporary class added to the target element only while the marker is hovered/focused (matches the style.js definition).
const TARGET_HIGHLIGHT_CLASS = 'help-layer-target-highlight';

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
 * @param {() => void} [options.onOverlapResolved]
 * @param {(record: import('./matcher.js').HelpRecord) => void} [options.onMarkerHidden] called when a
 *   marker's target transitions to hidden (e.g. display:none) — lets the caller close a popup open on it
 * @param {string} [options.markerLabel] character shown on the marker (default '?')
 * @param {import('@floating-ui/dom').Placement} [options.markerPlacement] corner to overlap (default 'top-end')
 */
export function createMarkerManager(state, {
  onMarkerClick,
  onOverlapResolved,
  onMarkerHidden,
  markerLabel = '?',
  markerPlacement = 'top-end',
}) {
  /** @type {Map<Element|string, {record:import('./matcher.js').HelpRecord, el:HTMLElement, cleanup:() => void}>} */
  const markers = new Map();
  let rafId = null;
  // Don't schedule a new rAF during teardown (prevents a frame lingering after teardown).
  let tornDown = false;

  function runOverlapPass() {
    rafId = null;
    // Exclude hidden markers (floating.js sets inline display:none when a target goes display:none):
    // such a marker measures 0x0 at the origin, so leaving it in would make it count toward the
    // "<=1, skip" check and push visible markers away from (0,0).
    const entries = [...markers.values()].filter((e) => e.el.style.display !== 'none');
    // With one marker or fewer, overlap is impossible. Skip getBoundingClientRect (forced reflow)
    // and the O(n^2) push-out math entirely (avoids a per-frame reflow while scrolling on screens
    // with few targets). However, right after dropping from 2 to 1, if the remaining one still has
    // a leftover push-out transform, clear it and let an open popup follow that move (in steady
    // state, with an empty transform, do nothing).
    if (entries.length <= 1) {
      const el = entries.length === 1 ? entries[0].el : null;
      if (el && el.style.transform) {
        el.style.transform = '';
        if (onOverlapResolved) {
          onOverlapResolved();
        }
      }
      return;
    }

    // Clear the accumulated transform to measure base centers, then reapply after resolving overlaps.
    entries.forEach((e) => { e.el.style.transform = ''; });
    const centers = entries.map((e) => {
      const r = e.el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const offsets = resolveOverlaps(centers);
    entries.forEach((e, i) => {
      const { dx, dy } = offsets[i];
      e.el.style.transform = (dx || dy) ? `translate(${dx}px, ${dy}px)` : '';
    });

    // Marker positions moved, so give an open popup etc. the chance to follow.
    if (onOverlapResolved) {
      onOverlapResolved();
    }
  }

  function scheduleOverlapPass() {
    if (rafId !== null || tornDown) {
      return;
    }
    rafId = requestAnimationFrame(runOverlapPass);
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

    const cleanupAnchor = anchorMarker(
      referenceFor(record),
      el,
      scheduleOverlapPass,
      markerPlacement,
      () => onMarkerHidden && onMarkerHidden(record),
    );

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
      cleanupAnchor();
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
      scheduleOverlapPass();
    };

    markers.set(record.id, { record, el, cleanup });
  }

  function unmount(id) {
    const entry = markers.get(id);
    if (entry) {
      entry.cleanup();
    }
  }

  function mountAll(records) {
    records.forEach(mount);
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
    // Return the first entry matching the config key (either element-bound or free placement).
    // Used by the programmatic open(key).
    findByKey(key) {
      for (const entry of markers.values()) {
        if (entry.record.key === key) {
          return entry;
        }
      }
      return null;
    },
  };
}
