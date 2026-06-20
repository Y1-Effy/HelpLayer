/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// Mock floating.js's watchReference. Call onUpdate once to also exercise the clip-update path.
jest.unstable_mockModule('../src/floating.js', () => ({
  watchReference: jest.fn((ref, floatingEl, onUpdate) => {
    onUpdate();
    return jest.fn();
  }),
  anchorMarker: jest.fn(() => jest.fn()),
  anchorPopup: jest.fn(() => ({ update: jest.fn(), cleanup: jest.fn() })),
  makeVirtualElement: jest.fn(),
}));

const { activateBlockingLayer } = await import('../src/blocking-layer.js');
const { createState } = await import('../src/state.js');

let toggleEl;
let state;

function activate(overrides = {}) {
  return activateBlockingLayer(state, {
    toggleEl,
    onBackgroundClick: jest.fn(),
    isLibraryElement: (t) => t === toggleEl || (t && t.classList && t.classList.contains('lib')),
    onEscape: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  state = createState();
  toggleEl = document.createElement('button');
  document.body.appendChild(toggleEl);
});

afterEach(() => {
  state.teardownAll();
  document.body.innerHTML = '';
});

describe('activateBlockingLayer: focus containment', () => {
  it('does not blur the toggle that is the origin of turning ON (#3)', () => {
    toggleEl.focus();
    expect(document.activeElement).toBe(toggleEl);

    activate();

    expect(document.activeElement).toBe(toggleEl);
  });

  it('removes focus from host elements other than the toggle', () => {
    const host = document.createElement('input');
    document.body.appendChild(host);
    host.focus();
    expect(document.activeElement).toBe(host);

    activate();

    expect(document.activeElement).not.toBe(host);
  });

  it('takes focus moving to the host back to the toggle', () => {
    activate();
    const host = document.createElement('input');
    document.body.appendChild(host);
    const focusSpy = jest.spyOn(toggleEl, 'focus');

    host.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(focusSpy).toHaveBeenCalled();
  });
});

describe('activateBlockingLayer: key input', () => {
  it('suppresses keydown outside the library UI', () => {
    activate();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    host.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
  });

  it('lets keydown inside the library UI through', () => {
    activate();
    const libEl = document.createElement('div');
    libEl.className = 'lib';
    document.body.appendChild(libEl);

    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    libEl.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(false);
  });

  it('keypress is also suppressed (#4)', () => {
    activate();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const ev = new KeyboardEvent('keypress', { key: 'a', bubbles: true, cancelable: true });
    host.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
  });

  it('Escape calls onEscape and preventDefaults', () => {
    const onEscape = jest.fn();
    activate({ onEscape });

    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('activateBlockingLayer: layer', () => {
  it('appends the layer to body and sets clip-path', () => {
    const layer = activate();
    expect(layer.classList.contains('help-layer-blocking-layer')).toBe(true);
    expect(layer.isConnected).toBe(true);
    expect(layer.style.clipPath).toContain('polygon');
  });

  it('removes the layer on teardown', () => {
    activate();
    expect(document.querySelector('.help-layer-blocking-layer')).not.toBeNull();

    state.teardownAll();
    expect(document.querySelector('.help-layer-blocking-layer')).toBeNull();
  });
});
