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

  it('scales to many markers without runaway cost (perf guard)', () => {
    // This is the heaviest hot path with many markers: O(iterations * n^2). A dense grid where many
    // neighbours overlap is the worst-ish case. The test guards against an accidental complexity
    // regression (extra nesting -> O(n^3)) or a non-terminating loop, and that no divide-by-zero
    // produces NaN/Infinity at scale. The time budget is deliberately generous: the real cost is a
    // few ms, but `jest --coverage` instrumentation slows this hot loop by orders of magnitude, so
    // the budget is sized for the instrumented run. It only trips on a catastrophic regression,
    // never on normal CI hardware variance.
    const n = 1000;
    const cols = 40;
    const centers = [];
    for (let i = 0; i < n; i++) {
      centers.push({ x: (i % cols) * 10, y: Math.floor(i / cols) * 10 });
    }

    const start = Date.now();
    const offsets = resolveOverlaps(centers);
    const elapsed = Date.now() - start;

    expect(offsets).toHaveLength(n);
    expect(offsets.every((o) => Number.isFinite(o.dx) && Number.isFinite(o.dy))).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });
});
