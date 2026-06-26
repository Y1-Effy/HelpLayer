import {
  computePopupPosition,
  docRectToViewportRect,
  markerViewportTopLeft,
  toDocumentPosition,
  viewportToAbsolute,
} from '../src/geometry.js';

describe('toDocumentPosition', () => {
  it('adds rect and scroll offset to return document coordinates', () => {
    const rect = { top: 100, left: 50 };
    const scroll = { x: 20, y: 300 };

    expect(toDocumentPosition(rect, scroll)).toEqual({ top: 400, left: 70 });
  });

  it('returns rect values as-is even when scroll is zero', () => {
    const rect = { top: 10, left: 10 };
    const scroll = { x: 0, y: 0 };

    expect(toDocumentPosition(rect, scroll)).toEqual({ top: 10, left: 10 });
  });
});

describe('docRectToViewportRect', () => {
  it('subtracts scroll offset from document coordinates to get viewport coordinates', () => {
    const result = docRectToViewportRect({ top: 400, left: 70, width: 0, height: 0 }, { x: 20, y: 300 });

    expect(result).toMatchObject({ top: 100, left: 50, right: 50, bottom: 100, width: 0, height: 0 });
  });

  it('reflects width/height into right/bottom when present', () => {
    const result = docRectToViewportRect({ top: 100, left: 100, width: 30, height: 20 }, { x: 0, y: 0 });

    expect(result).toMatchObject({ left: 100, top: 100, right: 130, bottom: 120, width: 30, height: 20 });
  });
});

describe('markerViewportTopLeft', () => {
  // size 22 -> INSET 11 (half). Hand-derived to match the old computePosition(placement) + offset path.
  const ref = { top: 100, left: 200, width: 80, height: 40 };
  const SIZE = 22;

  it('overlaps the top-end corner (default)', () => {
    // above and bitten 11px down (top - size + 11), right edges aligned then nudged 11px inward.
    expect(markerViewportTopLeft(ref, SIZE, 'top-end')).toEqual({ left: 247, top: 89 });
  });

  it('overlaps the top-start corner', () => {
    expect(markerViewportTopLeft(ref, SIZE, 'top-start')).toEqual({ left: 211, top: 89 });
  });

  it('overlaps the bottom-end corner', () => {
    expect(markerViewportTopLeft(ref, SIZE, 'bottom-end')).toEqual({ left: 247, top: 129 });
  });

  it('overlaps the bottom-start corner', () => {
    expect(markerViewportTopLeft(ref, SIZE, 'bottom-start')).toEqual({ left: 211, top: 129 });
  });

  it('defaults to top-end when no placement is given', () => {
    expect(markerViewportTopLeft(ref, SIZE)).toEqual({ left: 247, top: 89 });
  });

  it('centers on the cross axis for a bare side (no alignment)', () => {
    // 'top' (no -start/-end): horizontally centered on the target, then nudged 11px inward.
    // left = 200 + 80/2 - 22/2 = 229, minus 11 (cross) = 218; top = 100 - 22 + 11 = 89.
    expect(markerViewportTopLeft(ref, SIZE, 'top')).toEqual({ left: 218, top: 89 });
  });

  it('overlaps the left-start corner (horizontal placement)', () => {
    // side left: left = 200 - 22 + 11 = 189; start: top = ref.top = 100, plus 11 (cross) = 111.
    expect(markerViewportTopLeft(ref, SIZE, 'left-start')).toEqual({ left: 189, top: 111 });
  });

  it('overlaps the right-end corner (horizontal placement)', () => {
    // side right: left = 200 + 80 - 11 = 269; end: top = 100 + 40 - 22 = 118, minus 11 (cross) = 107.
    expect(markerViewportTopLeft(ref, SIZE, 'right-end')).toEqual({ left: 269, top: 107 });
  });

  it('centers vertically for a bare horizontal side', () => {
    // 'left' (no align): left = 189; top center = 100 + 40/2 - 22/2 = 109, minus 11 (cross) = 98.
    expect(markerViewportTopLeft(ref, SIZE, 'left')).toEqual({ left: 189, top: 98 });
  });
});

describe('viewportToAbsolute', () => {
  it('subtracts the offsetParent rect and border to get absolute coordinates', () => {
    const bodyRect = { left: 8, top: 8 }; // body with an 8px margin
    expect(viewportToAbsolute(247, 89, bodyRect, 0, 0)).toEqual({ left: 239, top: 81 });
  });

  it('subtracts the body border (clientLeft/clientTop) too', () => {
    expect(viewportToAbsolute(100, 100, { left: 0, top: 0 }, 2, 3)).toEqual({ left: 98, top: 97 });
  });

  it('is scroll-invariant: shifting the reference and body equally leaves the result unchanged', () => {
    const before = viewportToAbsolute(247, 89, { left: 8, top: 8 }, 0, 0);
    // After scrolling 50px down/30 right, both the reference viewport coord and bodyRect shift equally.
    const after = viewportToAbsolute(247 - 30, 89 - 50, { left: 8 - 30, top: 8 - 50 }, 0, 0);
    expect(after).toEqual(before);
  });
});

describe('computePopupPosition', () => {
  const popup = { width: 200, height: 80 };
  const viewport = { width: 1000, height: 1000 };

  it('places below and start-aligned by default, with the offset gap', () => {
    const ref = { top: 100, left: 100, width: 50, height: 20 };
    // below: 100 + 20 + 8 = 128; start: left = ref.left = 100.
    expect(computePopupPosition(ref, popup, viewport)).toEqual({ left: 100, top: 128, placement: 'bottom-start' });
  });

  it('flips to the top when the bottom side cannot fit the popup', () => {
    const ref = { top: 950, left: 100, width: 50, height: 20 };
    // bottom has only ~14px of room (< 80), top has plenty, so flip: top = 950 - 80 - 8 = 862.
    expect(computePopupPosition(ref, popup, viewport)).toEqual({ left: 100, top: 862, placement: 'top-start' });
  });

  it('shifts left to keep the popup inside the right edge', () => {
    const ref = { top: 100, left: 950, width: 40, height: 20 };
    // start would put left=950; clamp to viewport.width - popup.width - padding = 1000 - 200 - 8 = 792.
    expect(computePopupPosition(ref, popup, viewport)).toMatchObject({ left: 792, top: 128 });
  });

  it('shifts right to keep the popup inside the left edge', () => {
    const ref = { top: 100, left: -30, width: 40, height: 20 };
    expect(computePopupPosition(ref, popup, viewport)).toMatchObject({ left: 8 });
  });

  it('pins to the padding when the popup is wider than the viewport', () => {
    const ref = { top: 100, left: 100, width: 50, height: 20 };
    const wide = { width: 2000, height: 80 };
    expect(computePopupPosition(ref, wide, viewport)).toMatchObject({ left: 8 });
  });

  it('honors a horizontal placement (right-start) along the cross axis', () => {
    const ref = { top: 100, left: 100, width: 50, height: 20 };
    // right: left = 100 + 50 + 8 = 158; start: top = ref.top = 100.
    expect(computePopupPosition(ref, popup, viewport, { placement: 'right-start' }))
      .toEqual({ left: 158, top: 100, placement: 'right-start' });
  });

  it('end-aligns on the cross axis (bottom-end)', () => {
    const ref = { top: 100, left: 400, width: 50, height: 20 };
    // end: left = ref.left + ref.width - popup.width = 400 + 50 - 200 = 250 (fits, no shift); below: 128.
    expect(computePopupPosition(ref, popup, viewport, { placement: 'bottom-end' }))
      .toEqual({ left: 250, top: 128, placement: 'bottom-end' });
  });

  it('center-aligns on the cross axis for a bare side (bottom)', () => {
    const ref = { top: 100, left: 400, width: 50, height: 20 };
    // center: left = 400 + 50/2 - 200/2 = 325; below: 128.
    expect(computePopupPosition(ref, popup, viewport, { placement: 'bottom' }))
      .toEqual({ left: 325, top: 128, placement: 'bottom' });
  });

  it('places to the left when there is room (left-start)', () => {
    const ref = { top: 100, left: 400, width: 50, height: 20 };
    // left: left = ref.left - popup.width - offset = 400 - 200 - 8 = 192; start: top = ref.top = 100.
    expect(computePopupPosition(ref, popup, viewport, { placement: 'left-start' }))
      .toEqual({ left: 192, top: 100, placement: 'left-start' });
  });
});
