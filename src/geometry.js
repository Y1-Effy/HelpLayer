/**
 * Pure geometry calculations. Takes no DOM elements, only numbers already read off.
 *
 * Clamping things that overflow the viewport is handled by Floating UI's shift()
 * middleware. toDocumentPosition is used for the virtual-element math of free placement, etc.
 */

/**
 * Given getBoundingClientRect() values (viewport-relative) and the scroll offset,
 * compute coordinates relative to the whole document.
 */
export function toDocumentPosition(rect, scroll) {
  return {
    top: rect.top + scroll.y,
    left: rect.left + scroll.x,
  };
}

/**
 * Convert a document-coordinate rect into a viewport-coordinate rect by subtracting
 * the current scroll offset. This is what the getBoundingClientRect of a Floating UI
 * virtual reference element (a free-placement marker) returns.
 * @param {{top:number,left:number,width?:number,height?:number}} docRect
 * @param {{x:number,y:number}} scroll
 */
export function docRectToViewportRect(docRect, scroll) {
  const width = docRect.width || 0;
  const height = docRect.height || 0;
  const left = docRect.left - scroll.x;
  const top = docRect.top - scroll.y;
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

// Half of the default marker size (24px). The marker bites this far inward past the target's edge so
// it overlaps the corner with an "inset". (If the marker-size CSS variable is changed, the marker
// size is read at runtime in markers.js, but this inset stays fixed = existing behavior.)
export const MARKER_INSET = 12;

/**
 * Compute a marker's top-left in viewport coordinates so it overlaps a corner of the reference rect,
 * replicating what Floating UI's computePosition(placement) + offset(markerOffset) produced before.
 *
 * placement is "<side>" or "<side>-<align>" where side is top/bottom/left/right and align is
 * start/end (omitted = centered). The marker is a square of the given size. mainAxis bites INSET
 * inward (overlapping the target edge); crossAxis nudges INSET inward from the aligned edge.
 * @param {{top:number,left:number,width:number,height:number}} refRect viewport rect of the target
 * @param {number} size marker width/height (square)
 * @param {string} placement Floating UI placement (default 'top-end')
 * @returns {{left:number, top:number}} viewport coordinates of the marker's top-left corner
 */
export function markerViewportTopLeft(refRect, size, placement = 'top-end') {
  const [side, align] = placement.split('-');
  const isStart = align === 'start';
  // crossAxis: -end (right/bottom-aligned) goes inward negative; -start goes inward positive.
  const cross = isStart ? MARKER_INSET : -MARKER_INSET;

  let left;
  let top;
  if (side === 'top' || side === 'bottom') {
    // Vertical placement: main axis is Y, cross axis is X.
    top = side === 'top'
      ? refRect.top - size + MARKER_INSET // above, then bite down into the target
      : refRect.top + refRect.height - MARKER_INSET; // below, then bite up
    if (align === 'start') {
      left = refRect.left;
    } else if (align === 'end') {
      left = refRect.left + refRect.width - size;
    } else {
      left = refRect.left + refRect.width / 2 - size / 2;
    }
    left += cross;
  } else {
    // Horizontal placement (left/right): main axis is X, cross axis is Y.
    left = side === 'left'
      ? refRect.left - size + MARKER_INSET
      : refRect.left + refRect.width - MARKER_INSET;
    if (align === 'start') {
      top = refRect.top;
    } else if (align === 'end') {
      top = refRect.top + refRect.height - size;
    } else {
      top = refRect.top + refRect.height / 2 - size / 2;
    }
    top += cross;
  }
  return { left, top };
}

/**
 * Convert a viewport coordinate into the left/top to set on a `position:absolute` element whose
 * offsetParent is `document.body`. Both the marker's reference rect and the body rect come from
 * getBoundingClientRect (viewport space), so their difference is scroll-invariant — which is exactly
 * why the marker stays anchored to its target as the page scrolls. clientLeft/clientTop subtract the
 * body's border so the offset is measured from the body's padding-box origin (the absolute origin).
 * For `position:fixed` markers no conversion is needed (viewport coordinates are used as-is).
 * @param {number} vx viewport x
 * @param {number} vy viewport y
 * @param {{left:number, top:number}} bodyRect document.body's getBoundingClientRect
 * @param {number} clientLeft document.body.clientLeft (left border width)
 * @param {number} clientTop document.body.clientTop (top border width)
 * @returns {{left:number, top:number}}
 */
export function viewportToAbsolute(vx, vy, bodyRect, clientLeft, clientTop) {
  return {
    left: vx - bodyRect.left - clientLeft,
    top: vy - bodyRect.top - clientTop,
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Compute the popup's top-left in viewport coordinates, replicating the small subset of Floating UI
 * we relied on: place on a side of the reference with a gap (offset), flip to the opposite side when
 * the preferred side doesn't fit (main axis), and shift along the cross axis to keep it inside the
 * viewport (with padding). This covers the popup's case — a single element over document.body whose
 * clipping boundary is the viewport — and is intentionally simpler than Floating UI (no nested
 * clipping ancestors / transforms / RTL).
 *
 * placement is "<side>" or "<side>-<align>" (side: top/bottom/left/right; align: start/end, omitted = center).
 * @param {{top:number,left:number,width:number,height:number}} refRect viewport rect of the reference
 * @param {{width:number,height:number}} popupSize the popup's measured size
 * @param {{width:number,height:number}} viewport innerWidth/innerHeight
 * @param {object} [opts]
 * @param {string} [opts.placement] default 'bottom-start'
 * @param {number} [opts.offset] gap between reference and popup along the main axis (default 8)
 * @param {number} [opts.padding] minimum gap kept from the viewport edges (default 8)
 * @returns {{left:number, top:number, placement:string}} resolved viewport coords + the side actually used
 */
export function computePopupPosition(refRect, popupSize, viewport, opts = {}) {
  const placement = opts.placement ?? 'bottom-start';
  const offset = opts.offset ?? 8;
  const padding = opts.padding ?? 8;
  const [side, align] = placement.split('-');
  const vertical = side === 'top' || side === 'bottom';

  // Main-axis position for a given side (top/left coordinate that places the popup on that side).
  const mainPos = (s) => {
    if (s === 'bottom') {
      return refRect.top + refRect.height + offset;
    }
    if (s === 'top') {
      return refRect.top - popupSize.height - offset;
    }
    if (s === 'right') {
      return refRect.left + refRect.width + offset;
    }
    return refRect.left - popupSize.width - offset; // left
  };

  // Available space (for the popup) on a side, after keeping `padding` from the viewport edge.
  const spaceFor = (s) => {
    if (s === 'bottom') {
      return viewport.height - padding - (refRect.top + refRect.height + offset);
    }
    if (s === 'top') {
      return refRect.top - offset - padding;
    }
    if (s === 'right') {
      return viewport.width - padding - (refRect.left + refRect.width + offset);
    }
    return refRect.left - offset - padding; // left
  };

  // Flip (main axis): if the preferred side can't fit the popup, use whichever side has more room.
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
  const need = vertical ? popupSize.height : popupSize.width;
  const chosen = spaceFor(side) >= need || spaceFor(side) >= spaceFor(opposite) ? side : opposite;

  // Cross-axis position from the alignment.
  const crossPos = (extentRef, extentPopup, start) => {
    if (align === 'start') {
      return start;
    }
    if (align === 'end') {
      return start + extentRef - extentPopup;
    }
    return start + extentRef / 2 - extentPopup / 2;
  };

  let left;
  let top;
  if (vertical) {
    top = mainPos(chosen);
    left = crossPos(refRect.width, popupSize.width, refRect.left);
    // Shift along x to keep the popup within the viewport.
    left = clamp(left, padding, viewport.width - popupSize.width - padding);
  } else {
    left = mainPos(chosen);
    top = crossPos(refRect.height, popupSize.height, refRect.top);
    // Shift along y to keep the popup within the viewport.
    top = clamp(top, padding, viewport.height - popupSize.height - padding);
  }

  return { left, top, placement: align ? `${chosen}-${align}` : chosen };
}
