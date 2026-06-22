/** @jest-environment jsdom */
import { isolateBackgroundFromAT } from '../src/aria-isolation.js';
import { createState } from '../src/state.js';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Wait one tick so the body MutationObserver (microtask-based in jsdom) fires. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const addChild = (tag = 'div') => {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
};

const libraryNode = (cls) => {
  const el = addChild('div');
  el.className = cls;
  return el;
};

describe('isolateBackgroundFromAT', () => {
  it('inerts host children but not library nodes or the toggle branch', () => {
    const host = addChild();
    const marker = libraryNode('help-layer-marker');
    const layer = libraryNode('help-layer-blocking-layer');
    const popupRoot = libraryNode('help-layer-popup');
    // The toggle nested inside a host header: its whole top-level branch must stay reachable.
    const header = addChild('header');
    const toggleEl = document.createElement('button');
    header.appendChild(toggleEl);

    const isLibraryNode = (el) => el === layer || el === popupRoot || el.classList.contains('help-layer-marker');

    const state = createState();
    isolateBackgroundFromAT(state, { toggleEl, isLibraryNode });

    expect(host.hasAttribute('inert')).toBe(true);
    expect(marker.hasAttribute('inert')).toBe(false);
    expect(layer.hasAttribute('inert')).toBe(false);
    expect(popupRoot.hasAttribute('inert')).toBe(false);
    expect(header.hasAttribute('inert')).toBe(false); // contains the toggle
  });

  it('leaves a host-owned inert untouched and does not strip it on teardown', () => {
    const preInert = addChild();
    preInert.setAttribute('inert', '');

    const state = createState();
    isolateBackgroundFromAT(state, { toggleEl: null, isLibraryNode: () => false });

    expect(preInert.hasAttribute('inert')).toBe(true);
    state.teardownAll();
    // We never added it, so we must not remove the host's own inert.
    expect(preInert.hasAttribute('inert')).toBe(true);
  });

  it('inerts host nodes added while ON but skips dynamically added markers', async() => {
    const isLibraryNode = (el) => el.classList.contains('help-layer-marker');
    const state = createState();
    isolateBackgroundFromAT(state, { toggleEl: null, isLibraryNode });

    const lateHost = addChild();
    const lateMarker = libraryNode('help-layer-marker');
    await tick();

    expect(lateHost.hasAttribute('inert')).toBe(true);
    expect(lateMarker.hasAttribute('inert')).toBe(false);
  });

  it('removes only the inert it added on teardown', () => {
    const host1 = addChild();
    const host2 = addChild();

    const state = createState();
    isolateBackgroundFromAT(state, { toggleEl: null, isLibraryNode: () => false });
    expect(host1.hasAttribute('inert')).toBe(true);
    expect(host2.hasAttribute('inert')).toBe(true);

    state.teardownAll();
    expect(host1.hasAttribute('inert')).toBe(false);
    expect(host2.hasAttribute('inert')).toBe(false);
  });

  it('with no toggle, inerts every non-library child (whole-surface block)', () => {
    const host = addChild();
    const marker = libraryNode('help-layer-marker');

    const state = createState();
    isolateBackgroundFromAT(state, {
      toggleEl: null,
      isLibraryNode: (el) => el.classList.contains('help-layer-marker'),
    });

    expect(host.hasAttribute('inert')).toBe(true);
    expect(marker.hasAttribute('inert')).toBe(false);
  });
});
