import { docRectToViewportRect, toDocumentPosition } from '../src/geometry.js';

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
