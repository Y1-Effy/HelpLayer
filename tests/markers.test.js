/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// Mock floating.js because its Floating UI bits (anchorPopup/watchReference) need layout APIs jsdom
// lacks. markers.js itself now positions markers in its own rAF loop and only uses the small helpers
// below from floating.js, which we stub so the tests drive visibility/strategy explicitly.
const isReferenceHidden = jest.fn(() => false);
const isFixedReference = jest.fn(() => false);
jest.unstable_mockModule('../src/floating.js', () => ({
  isReferenceHidden,
  isFixedReference,
  makeVirtualElement: jest.fn((getRect) => ({ getBoundingClientRect: getRect })),
  anchorPopup: jest.fn(() => ({ update: jest.fn(), cleanup: jest.fn() })),
  watchReference: jest.fn(() => jest.fn()),
}));

const { createMarkerManager } = await import('../src/markers.js');
const { createState } = await import('../src/state.js');

// Manually control requestAnimationFrame so we can run the positioning loop one frame at a time and
// verify no frame lingers after teardown. forEach over the snapshot doesn't re-run frames the loop
// re-schedules during the call (Array.forEach skips entries appended mid-iteration).
let rafCallbacks;
let rafSeq;
beforeEach(() => {
  rafCallbacks = [];
  rafSeq = 0;
  isReferenceHidden.mockReset();
  isReferenceHidden.mockReturnValue(false);
  isFixedReference.mockReset();
  isFixedReference.mockReturnValue(false);
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

// Run every currently-queued frame once (the loop reschedules itself, but those land after the snapshot).
const runFrames = () => rafCallbacks.forEach(([, cb]) => cb());

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
  });

  it('reflects markerLabel into the marker character', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn(), markerLabel: 'i' });
    manager.mount(elementRecord('a'));

    expect(document.querySelector('.help-layer-marker').textContent).toBe('i');
  });

  it('markerLabel defaults to "?"', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));

    expect(document.querySelector('.help-layer-marker').textContent).toBe('?');
  });

  it('positions a marker per markerPlacement (the loop writes left/top)', () => {
    // jsdom reports a 0x0 reference rect and offsetWidth 0, so the marker size falls back to 22.
    // bottom-start of a rect at (0,0): top = 0 + height - 11 = -11; left = 0 + 11 = 11.
    const state = createState();
    const manager = createMarkerManager(state, {
      onMarkerClick: jest.fn(),
      markerPlacement: 'bottom-start',
    });
    manager.mount(elementRecord('a'));

    runFrames();

    const markerEl = document.querySelector('.help-layer-marker');
    expect(markerEl.style.left).toBe('11px');
    expect(markerEl.style.top).toBe('-11px');
  });

  it('uses the fixed strategy (inline position) for a fixed reference', () => {
    isFixedReference.mockReturnValue(true);
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));

    expect(document.querySelector('.help-layer-marker').style.position).toBe('fixed');
  });

  it('calls onMarkerHidden with the record when the target transitions to hidden', () => {
    isReferenceHidden.mockReturnValue(true); // the target is reported hidden this frame
    const onMarkerHidden = jest.fn();
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn(), onMarkerHidden });
    const record = elementRecord('a');
    manager.mount(record);

    runFrames();

    expect(onMarkerHidden).toHaveBeenCalledWith(record);
    // The marker is also hidden so it doesn't fling to (0,0).
    expect(document.querySelector('.help-layer-marker').style.display).toBe('none');
  });

  it('fires onMarkerHidden only on the visible -> hidden edge, not every frame', () => {
    const onMarkerHidden = jest.fn();
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn(), onMarkerHidden });
    manager.mount(elementRecord('a'));

    isReferenceHidden.mockReturnValue(true);
    runFrames(); // first hidden frame: edge fires
    runFrames(); // still hidden: no repeat

    expect(onMarkerHidden).toHaveBeenCalledTimes(1);
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
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const record = elementRecord('a');
    manager.mount(record);

    manager.unmount(record.id);
    manager.unmount(record.id); // the second call does nothing

    expect(manager.has(record.id)).toBe(false);
    expect(document.querySelectorAll('.help-layer-marker')).toHaveLength(0);
  });

  it('with two overlapping markers, pushes them apart', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));
    manager.mount(elementRecord('b'));

    runFrames();

    // Both references measure the same 0x0 rect, so overlap avoidance separates the two markers.
    const markerEls = [...document.querySelectorAll('.help-layer-marker')];
    expect(markerEls[0].style.left).not.toBe(markerEls[1].style.left);
  });

  it('reads each reference rect once per frame (plus the shared offsetParent), no O(n^2) reflow', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const n = 30;
    for (let i = 0; i < n; i++) {
      manager.mount(elementRecord(`m${i}`));
    }

    // Spy only around the frame so the count reflects the positioning pass alone.
    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    runFrames();

    // One read per reference + one for document.body: linear, not per-pair.
    expect(rectSpy.mock.calls).toHaveLength(n + 1);
    rectSpy.mockRestore();
  });

  it('excludes a hidden marker from overlap avoidance (not measured)', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    const a = elementRecord('a');
    const b = elementRecord('b');
    manager.mount(a);
    manager.mount(b);

    // Report only the first target hidden. With one visible reference left, only that reference and
    // document.body are measured (the hidden one is skipped before its rect is read).
    isReferenceHidden.mockImplementation((ref) => ref === a.target);
    const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    runFrames();

    expect(rectSpy.mock.calls).toHaveLength(2); // one visible reference + document.body
    rectSpy.mockRestore();
  });

  it('does not schedule a new rAF after teardown (regression: #1)', () => {
    const state = createState();
    const manager = createMarkerManager(state, { onMarkerClick: jest.fn() });
    manager.mount(elementRecord('a'));
    manager.mount(elementRecord('b'));

    // A frame is pending from mount; teardown cancels it and removes the markers.
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
    state.teardownAll();

    expect(rafCallbacks).toHaveLength(0);
    expect(document.querySelectorAll('.help-layer-marker')).toHaveLength(0);
  });
});
