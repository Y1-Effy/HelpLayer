/** @jest-environment jsdom */

/**
 * Interchangeability guard: the two positioning backends must expose an identical public surface so
 * the one-line seam in floating.js can switch between them without breaking any consumer. If you add
 * or rename an export in one backend, this fails until the other matches.
 */
import * as floatingui from '../src/floating.floatingui.js';
import * as self from '../src/floating.self.js';

test('both backends export the same set of names', () => {
  const selfKeys = Object.keys(self).sort();
  const fuiKeys = Object.keys(floatingui).sort();
  expect(selfKeys).toEqual(fuiKeys);
  // Sanity: the surface the rest of the library relies on.
  expect(selfKeys).toEqual(
    ['anchorPopup', 'isFixedReference', 'isReferenceHidden', 'makeVirtualElement', 'watchReference'],
  );
});
