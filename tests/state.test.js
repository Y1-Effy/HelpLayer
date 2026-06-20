import { jest } from '@jest/globals';

import { createState } from '../src/state.js';

describe('createState', () => {
  it('runs teardown callbacks in LIFO order', () => {
    const order = [];
    const state = createState();
    state.track(() => order.push('first'));
    state.track(() => order.push('second'));
    state.track(() => order.push('third'));

    state.teardownAll();

    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('keeps unwinding the rest when one teardown throws (and logs it)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const earlier = jest.fn();
    const state = createState();
    // earlier is registered first, so it sits below the throwing one in the LIFO stack:
    // it must still run even though the later teardown blows up.
    state.track(earlier);
    state.track(() => { throw new Error('boom'); });

    expect(() => state.teardownAll()).not.toThrow();
    expect(earlier).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[help-layer] teardown step threw:', expect.any(Error));

    errorSpy.mockRestore();
  });

  it('empties the registry so a second teardownAll is a no-op', () => {
    const fn = jest.fn();
    const state = createState();
    state.track(fn);

    state.teardownAll();
    state.teardownAll();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
