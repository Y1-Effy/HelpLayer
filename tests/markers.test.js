/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// Mock floating.js because it uses @floating-ui/dom (ResizeObserver etc. that jsdom doesn't support).
const anchorMarker = jest.fn(() => jest.fn());
jest.unstable_mockModule('../src/floating.js', () => ({
  anchorMarker,
  makeVirtualElement: jest.fn((getRect) => ({ getBoundingClientRect: getRect })),
  anchorPopup: jest.fn(() => ({ update: jest.fn(), cleanup: jest.fn() })),
  watchReference: jest.fn(() => jest.fn()),
}));

const { createMarkerManager } = await import('../src/markers.js');
const { createState } = await import('../src/state.js');

// Manually control requestAnimationFrame to verify no frame lingers after teardown.
let rafCallbacks;
let rafSeq;
beforeEach(() => {
  rafCallbacks = [];
  rafSeq = 0;
  anchorMarker.mockClear();
  global.requestAnimationFrame = (cb) => {
    rafSeq += 1;
    rafCallbacks.push([rafSeq, cb]);
    return rafSeq;
  };
  global.cancelAnimationFrame = (id) => {
    rafCallbacks = rafCallbacks.filter(([i]) => i !== id);
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

const elementRecord = (id) => {
  const target = document.createElement('button');
  target.setAttribute('data-help-id', id);
  document.body.appendChild(target);
  return { id: target, kind: 'element', key: id, title: id, text: `${id} text`, target };
};

describe('createMarkerManager', () => {
  it('creates a marker on mount and ignores re-mounting the same id', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const record = elementRecord('a');

    manager.mount(record);
    manager.mount(record);

    expect(manager.has(record.id)).toBe(true);
    expect(document.querySelectorAll('.help-layer-marker')).toHaveLength(1);
    expect(anchorMarker).toHaveBeenCalledTimes(1);
  });

  it('reflects markerLabel into the marker character and passes markerPlacement to anchorMarker', () => {
    const state = createState();
    const manager = createMarkerManager(state, {
      onMarkerClick: jest.fn(),
      markerLabel: 'i',
      markerPlacement: 'bottom-start',
    });
    manager.mount(elementRecord('a'));

    const markerEl = document.querySelector('.help-layer-marker');
    expect(markerEl.textContent).toBe('i');
    // The 4th argument of anchorMarker(reference, el, onPlaced, placement).
    expect(anchorMarker.mock.calls[0][3]).toBe('bottom-start');
  });

  it('markerLabel defaults to "?"', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));

    expect(document.querySelector('.help-layer-marker').textContent).toBe('?');
  });

  it('calls onMarkerHidden with the record when the target transitions to hidden', () => {
    // anchorMarker's 5th arg is the onHidden callback; fire it synchronously to simulate the
    // visible -> hidden transition.
    anchorMarker.mockImplementationOnce((ref, el, onPlaced, placement, onHidden) => {
      if (onHidden) {
        onHidden();
      }
      return jest.fn();
    });
    const onMarkerHidden = jest.fn();
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn(), onMarkerHidden });
    const record = elementRecord('a');
    manager.mount(record);

    expect(onMarkerHidden).toHaveBeenCalledWith(record);
  });

  it('calls onMarkerClick with the record and marker element on click', () => {
    const onMarkerClick = jest.fn();
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick });
    const record = elementRecord('a');
    manager.mount(record);

    const markerEl = document.querySelector('.help-layer-marker');
    markerEl.click();

    expect(onMarkerClick).toHaveBeenCalledWith(record, markerEl);
  });

  it('removes the marker on unmount, and cleanup is idempotent', () => {
    const cleanupAnchor = jest.fn();
    anchorMarker.mockReturnValueOnce(cleanupAnchor);
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const record = elementRecord('a');
    manager.mount(record);

    manager.unmount(record.id);
    manager.unmount(record.id); // the second call does nothing

    expect(manager.has(record.id)).toBe(false);
    expect(document.querySelectorAll('.help-layer-marker')).toHaveLength(0);
    expect(cleanupAnchor).toHaveBeenCalledTimes(1);
  });

  it('with one marker, overlap avoidance does not force a reflow (getBoundingClientRect)', () => {
    // Call anchorMarker's onPlaced (3rd argument) synchronously to schedule the overlap-avoidance pass.
    anchorMarker.mockImplementation((ref, el, onPlaced) => {
      if (onPlaced) {
        onPlaced();
      }
      return jest.fn();
    });
    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');

    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('only'));

    // Run the scheduled rAF (with one marker it should early-skip, so no rect read should occur).
    rafCallbacks.forEach(([, cb]) => cb());

    expect(rectSpy).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('with two or more markers, overlap avoidance measures rects and pushes them out', () => {
    anchorMarker.mockImplementation((ref, el, onPlaced) => {
      if (onPlaced) {
        onPlaced();
      }
      return jest.fn();
    });
    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');

    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));
    manager.mount(elementRecord('b'));

    rafCallbacks.forEach(([, cb]) => cb());

    // Centers of both are measured (forcing reflow), and since they share coordinate (0,0) a push-out transform is applied.
    expect(rectSpy).toHaveBeenCalled();
    const markerEls = [...document.querySelectorAll('.help-layer-marker')];
    expect(markerEls.some((el) => el.style.transform !== '')).toBe(true);
    rectSpy.mockRestore();
  });

  it('reads each marker rect exactly once per pass (no O(n^2) reflow at scale)', () => {
    anchorMarker.mockImplementation((ref, el, onPlaced) => {
      if (onPlaced) {
        onPlaced();
      }
      return jest.fn();
    });

    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const n = 30;
    for (let i = 0; i < n; i++) {
      manager.mount(elementRecord(`m${i}`));
    }

    // Spy only around the pass so the count reflects the overlap pass alone (mounting reads no rects).
    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    rafCallbacks.forEach(([, cb]) => cb());

    // One measurement per marker, not per pair: guards against re-introducing O(n^2) forced reflow.
    expect(rectSpy.mock.calls).toHaveLength(n);
    rectSpy.mockRestore();
  });

  it('excludes a hidden marker from overlap avoidance', () => {
    anchorMarker.mockImplementation((ref, el, onPlaced) => {
      if (onPlaced) {
        onPlaced();
      }
      return jest.fn();
    });

    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));
    manager.mount(elementRecord('b'));

    // Simulate floating.js hiding one marker because its target went display:none. With only one
    // visible marker left, the pass must early-skip without measuring any rect (forcing a reflow).
    const markerEls = [...document.querySelectorAll('.help-layer-marker')];
    markerEls[0].style.display = 'none';

    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    rafCallbacks.forEach(([, cb]) => cb());

    expect(rectSpy).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('does not schedule a new rAF after teardown (regression: #1)', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));
    manager.mount(elementRecord('b'));

    // Teardown cleans up even when there's a pending frame just before.
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(0);
    state.teardownAll();

    expect(rafCallbacks).toHaveLength(0);
    expect(document.querySelectorAll('.help-layer-marker')).toHaveLength(0);
  });
});
