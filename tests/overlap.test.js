import { resolveOverlaps } from '../src/overlap.js';

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

describe('resolveOverlaps', () => {
  it('does not move markers that are far enough apart (offset 0)', () => {
    const centers = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const offsets = resolveOverlaps(centers);

    expect(offsets).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });

  it('separates two overlapping points to at least the minimum distance', () => {
    const centers = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
    const offsets = resolveOverlaps(centers, { minDistance: 26 });

    const moved = centers.map((c, i) => ({ x: c.x + offsets[i].dx, y: c.y + offsets[i].dy }));
    expect(dist(moved[0], moved[1])).toBeGreaterThanOrEqual(26 - 0.001);
  });

  it('separates deterministically even at exactly identical coordinates', () => {
    const centers = [{ x: 10, y: 10 }, { x: 10, y: 10 }];
    const offsets = resolveOverlaps(centers, { minDistance: 26 });

    const moved = centers.map((c, i) => ({ x: c.x + offsets[i].dx, y: c.y + offsets[i].dy }));
    expect(dist(moved[0], moved[1])).toBeGreaterThan(0);
  });

  it('does not mutate the input center coordinates', () => {
    const centers = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
    resolveOverlaps(centers);

    expect(centers).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  });

  it('a single marker has offset 0', () => {
    expect(resolveOverlaps([{ x: 3, y: 4 }])).toEqual([{ dx: 0, dy: 0 }]);
  });

  it('separates all pairs to at least the minimum distance even when 3 points are clustered', () => {
    const centers = [{ x: 0, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 4 }];
    const offsets = resolveOverlaps(centers, { minDistance: 20, iterations: 20 });
    const moved = centers.map((c, i) => ({ x: c.x + offsets[i].dx, y: c.y + offsets[i].dy }));

    expect(dist(moved[0], moved[1])).toBeGreaterThanOrEqual(20 - 1);
    expect(dist(moved[0], moved[2])).toBeGreaterThanOrEqual(20 - 1);
    expect(dist(moved[1], moved[2])).toBeGreaterThanOrEqual(20 - 1);
  });
});
