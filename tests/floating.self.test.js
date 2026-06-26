/** @jest-environment jsdom */
import { jest } from '@jest/globals';

import { anchorPopup, watchReference } from '../src/floating.self.js';

// Control the tracking loop frame-by-frame.
let rafCallbacks;
beforeEach(() => {
  rafCallbacks = [];
  global.requestAnimationFrame = (cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  };
  global.cancelAnimationFrame = jest.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const runFrame = () => rafCallbacks.splice(0).forEach((cb) => cb());

const stubRect = (el, rect) => {
  el.getBoundingClientRect = () => ({
    width: 0, height: 0, right: 0, bottom: 0, x: rect.left, y: rect.top, ...rect,
  });
};

describe('anchorPopup (self backend)', () => {
  it('positions the popup synchronously on creation (no waiting for a frame)', () => {
    const reference = document.createElement('button');
    const popup = document.createElement('div');
    document.body.append(reference, popup);
    stubRect(reference, { top: 100, left: 100, width: 50, height: 20 });

    anchorPopup(reference, popup);

    // jsdom popup size is 0x0; bottom-start of the ref → top = 100+20+8 = 128, left = 100 (absolute, body at 0,0).
    expect(popup.style.left).toBe('100px');
    expect(popup.style.top).toBe('128px');
    expect(popup.style.position).toBe('absolute');
  });

  it('uses the fixed strategy when the reference is in a fixed subtree', () => {
    const bar = document.createElement('div');
    bar.style.position = 'fixed';
    const reference = document.createElement('button');
    bar.appendChild(reference);
    const popup = document.createElement('div');
    document.body.append(bar, popup);
    stubRect(reference, { top: 100, left: 100, width: 50, height: 20 });

    anchorPopup(reference, popup);

    expect(popup.style.position).toBe('fixed');
  });

  it('repositions on a later frame when the reference moves, and cleanup stops tracking', () => {
    const reference = document.createElement('button');
    const popup = document.createElement('div');
    document.body.append(reference, popup);
    stubRect(reference, { top: 100, left: 100, width: 50, height: 20 });

    const { cleanup } = anchorPopup(reference, popup);
    expect(popup.style.top).toBe('128px');

    // Reference moves down; next frame should follow.
    stubRect(reference, { top: 300, left: 100, width: 50, height: 20 });
    runFrame();
    expect(popup.style.top).toBe('328px');

    cleanup();
    stubRect(reference, { top: 500, left: 100, width: 50, height: 20 });
    runFrame(); // no further callbacks scheduled after cleanup
    expect(popup.style.top).toBe('328px');
  });

  it('repositions on window resize even when the reference has not moved, and cleanup detaches', () => {
    const reference = document.createElement('button');
    const popup = document.createElement('div');
    document.body.append(reference, popup);
    stubRect(reference, { top: 100, left: 100, width: 50, height: 20 });

    const { cleanup } = anchorPopup(reference, popup);
    expect(popup.style.top).toBe('128px');

    // Reference stays put, but its rect "changes" only on the next read — simulate a resize that
    // would re-run flip/shift. We change the stub then fire resize (no rAF frame in between).
    stubRect(reference, { top: 250, left: 100, width: 50, height: 20 });
    window.dispatchEvent(new Event('resize'));
    expect(popup.style.top).toBe('278px');

    cleanup();
    stubRect(reference, { top: 400, left: 100, width: 50, height: 20 });
    window.dispatchEvent(new Event('resize')); // listener removed → no reposition
    expect(popup.style.top).toBe('278px');
  });
});

describe('watchReference (self backend)', () => {
  it('calls onUpdate once initially and again when the reference moves; cleanup detaches', () => {
    const reference = document.createElement('button');
    document.body.appendChild(reference);
    stubRect(reference, { top: 0, left: 0, width: 10, height: 10 });
    const onUpdate = jest.fn();

    const cleanup = watchReference(reference, document.createElement('div'), onUpdate);
    expect(onUpdate).toHaveBeenCalledTimes(1); // initial, synchronous

    runFrame(); // unchanged rect → no extra call
    expect(onUpdate).toHaveBeenCalledTimes(1);

    stubRect(reference, { top: 50, left: 0, width: 10, height: 10 });
    runFrame();
    expect(onUpdate).toHaveBeenCalledTimes(2);

    cleanup();
    stubRect(reference, { top: 99, left: 0, width: 10, height: 10 });
    runFrame();
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });
});
