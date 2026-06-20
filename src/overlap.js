/**
 * Overlap avoidance between markers (pure function).
 *
 * Takes an array of each marker's "base position" (the center coordinate Floating UI
 * decided on) and returns an array of extra offsets that push overlapping ones apart.
 * Touches no DOM.
 *
 * The algorithm is a simple iterative push-out (a lightweight force-based separation):
 * if two circles are closer than the minimum distance, push them apart in opposite
 * directions. Repeat a few times. Markers are small circles, so a circle-to-circle
 * distance test is enough.
 */

/**
 * @param {Array<{x:number,y:number}>} centers base coordinate of each marker center
 * @param {object} [options]
 * @param {number} [options.minDistance] center-to-center distance closer than this counts as overlap
 * @param {number} [options.iterations] number of iterations
 * @returns {Array<{dx:number,dy:number}>} offset to add to each marker
 */
export function resolveOverlaps(centers, options = {}) {
  const minDistance = options.minDistance ?? 26;
  const iterations = options.iterations ?? 6;

  // Working positions (base + accumulated offset).
  const positions = centers.map((c) => ({ x: c.x, y: c.y }));

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist >= minDistance) {
          continue;
        }

        // If the coordinates are exactly identical, separate in a deterministic direction (horizontal).
        if (dist === 0) {
          dx = 1;
          dy = 0;
          dist = 1;
        }

        const overlap = (minDistance - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;

        a.x -= ux * overlap;
        a.y -= uy * overlap;
        b.x += ux * overlap;
        b.y += uy * overlap;
        moved = true;
      }
    }

    if (!moved) {
      break;
    }
  }

  return positions.map((p, i) => ({
    dx: p.x - centers[i].x,
    dy: p.y - centers[i].y,
  }));
}
