/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// initHelpLayer just delegates to createToggleController, which reaches into the DOM layer. We don't
// need real Floating UI layout here, so mock floating.js (same convention as the other DOM tests),
// then dynamically import the public entry point.
jest.unstable_mockModule('../src/floating.js', () => ({
  anchorPopup: jest.fn(() => ({ update: jest.fn(), cleanup: jest.fn() })),
  makeVirtualElement: jest.fn((getRect) => ({ getBoundingClientRect: getRect })),
  watchReference: jest.fn(() => jest.fn()),
  isFixedReference: jest.fn(() => false),
  isReferenceHidden: jest.fn(() => false),
}));

const { initHelpLayer } = await import('../src/index.js');

const config = {
  save: { title: 'Save', text: 'Description of the save button' },
};

let toggleEl;

beforeEach(() => {
  // Markers' overlap-avoidance rAF isn't needed; just hand back an id.
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();

  document.body.innerHTML = '';
  document.head.querySelectorAll('[data-help-layer-style]').forEach((el) => el.remove());

  toggleEl = document.createElement('button');
  document.body.appendChild(toggleEl);

  const target = document.createElement('button');
  target.setAttribute('data-help-id', 'save');
  document.body.appendChild(target);
});

const markerCount = () => document.querySelectorAll('.help-layer-marker').length;

describe('initHelpLayer (public API contract)', () => {
  it('returns a handle exposing the full documented method surface', () => {
    const handle = initHelpLayer({ config, toggle: toggleEl });

    for (const name of ['enable', 'disable', 'toggle', 'isActive', 'open', 'close', 'update', 'destroy']) {
      expect(typeof handle[name]).toBe('function');
    }

    handle.destroy();
  });

  it('reflects active state through enable / disable / toggle', () => {
    const handle = initHelpLayer({ config, toggle: toggleEl });

    expect(handle.isActive()).toBe(false);

    handle.enable();
    expect(handle.isActive()).toBe(true);
    expect(markerCount()).toBeGreaterThan(0);

    handle.disable();
    expect(handle.isActive()).toBe(false);

    handle.toggle();
    expect(handle.isActive()).toBe(true);

    handle.destroy();
  });

  it('destroy() tears down everything it created', () => {
    const handle = initHelpLayer({ config, toggle: toggleEl });
    handle.enable();
    expect(markerCount()).toBeGreaterThan(0);

    handle.destroy();

    expect(markerCount()).toBe(0);
    expect(document.querySelector('.help-layer-blocking-layer')).toBeNull();
    expect(document.querySelector('.help-layer-popup')).toBeNull();
  });
});
