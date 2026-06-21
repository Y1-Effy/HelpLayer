/** @jest-environment jsdom */
import { jest } from '@jest/globals';

import {
  collectShadowRoots,
  createMutationWatcher,
  queryAllDeep,
} from '../src/observer.js';

/** MutationObserver fires on a microtask, so wait one tick. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('queryAllDeep', () => {
  it('collects matching elements in the normal DOM', () => {
    document.body.innerHTML = `
      <button data-help-id="a"></button>
      <div><button data-help-id="b"></button></div>
    `;
    const found = queryAllDeep(document, '[data-help-id]');
    expect(found.map((el) => el.getAttribute('data-help-id')).sort()).toEqual(['a', 'b']);
  });

  it('recurses into open shadowRoots as well', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button data-help-id="deep"></button>';

    const found = queryAllDeep(document, '[data-help-id]');
    expect(found).toHaveLength(1);
    expect(found[0].getAttribute('data-help-id')).toBe('deep');
  });
});

describe('collectShadowRoots', () => {
  it('collects all nested open shadowRoots (excluding itself)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const innerHost = document.createElement('div');
    shadow.appendChild(innerHost);
    const innerShadow = innerHost.attachShadow({ mode: 'open' });

    const roots = collectShadowRoots(document);
    expect(roots).toContain(shadow);
    expect(roots).toContain(innerShadow);
    expect(roots).toHaveLength(2);
  });
});

describe('createMutationWatcher', () => {
  it('notifies on addition/removal of matching elements', async() => {
    const onAdded = jest.fn();
    const onRemoved = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved,
    });

    const el = document.createElement('button');
    el.setAttribute('data-help-id', 'x');
    document.body.appendChild(el);
    await tick();
    expect(onAdded).toHaveBeenCalledWith(el);

    el.remove();
    await tick();
    expect(onRemoved).toHaveBeenCalledWith(el);

    watcher.disconnect();
  });

  it('also picks up matching elements inside an added subtree', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<span><button data-help-id="nested"></button></span>';
    document.body.appendChild(wrapper);
    await tick();

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded.mock.calls[0][0].getAttribute('data-help-id')).toBe('nested');

    watcher.disconnect();
  });

  it('picks up multiple matches in a larger added subtree without misses (regression for the single-traversal merge)', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <button data-help-id="a"></button>
      <section><div><button data-help-id="b"></button></div></section>
      <p>no match</p>
      <button data-help-id="c"></button>
    `;
    document.body.appendChild(wrapper);
    await tick();

    const ids = onAdded.mock.calls.map((c) => c[0].getAttribute('data-help-id')).sort();
    expect(ids).toEqual(['a', 'b', 'c']);

    watcher.disconnect();
  });

  it('also observes descendant shadowRoots in an added subtree and picks up later additions inside them', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    // Include a shadow host as a "descendant" of the subtree being added (attach the shadow before insertion).
    const wrapper = document.createElement('div');
    const innerHost = document.createElement('div');
    const shadow = innerHost.attachShadow({ mode: 'open' });
    wrapper.appendChild(innerHost);
    document.body.appendChild(wrapper);
    await tick();

    // Insert a matching element into that shadowRoot afterward -> should be picked up if observation was added.
    const btn = document.createElement('button');
    btn.setAttribute('data-help-id', 'inshadow');
    shadow.appendChild(btn);
    await tick();

    expect(onAdded).toHaveBeenCalledWith(btn);

    watcher.disconnect();
  });

  it('picks up matches inside the shadowRoot of an added node that is itself a shadow host', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    // The added node IS the shadow host (no wrapping element): its own shadowRoot must be scanned.
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button data-help-id="hostshadow"></button>';
    document.body.appendChild(host);
    await tick();

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onAdded.mock.calls[0][0].getAttribute('data-help-id')).toBe('hostshadow');

    watcher.disconnect();
  });

  it('observes the shadowRoot of an added host and picks up later additions inside it', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    await tick();

    const btn = document.createElement('button');
    btn.setAttribute('data-help-id', 'later');
    shadow.appendChild(btn);
    await tick();

    expect(onAdded).toHaveBeenCalledWith(btn);

    watcher.disconnect();
  });

  it('notifies removal of matches inside the shadowRoot when the host itself is removed', async() => {
    const onRemoved = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded: jest.fn(),
      onRemoved,
    });

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button data-help-id="gone"></button>';
    const inner = shadow.querySelector('[data-help-id]');
    document.body.appendChild(host);
    await tick();

    host.remove();
    await tick();

    expect(onRemoved).toHaveBeenCalledWith(inner);

    watcher.disconnect();
  });

  it('keeps processing the batch and stays observing when one onAdded throws', async() => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const seen = [];
    // Throw on the first matching element; the rest of the batch must still be delivered.
    const onAdded = jest.fn((el) => {
      seen.push(el.getAttribute('data-help-id'));
      if (el.getAttribute('data-help-id') === 'a') {
        throw new Error('mount bug');
      }
    });
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <button data-help-id="a"></button>
      <button data-help-id="b"></button>
    `;
    document.body.appendChild(wrapper);
    await tick();

    expect(seen.sort()).toEqual(['a', 'b']);
    expect(errorSpy).toHaveBeenCalledWith('[help-layer] observer onAdded threw:', expect.any(Error));

    // Observation must still be alive after the throw.
    const later = document.createElement('button');
    later.setAttribute('data-help-id', 'c');
    document.body.appendChild(later);
    await tick();
    expect(seen).toContain('c');

    watcher.disconnect();
    errorSpy.mockRestore();
  });

  it('does not notify after disconnect', async() => {
    const onAdded = jest.fn();
    const watcher = createMutationWatcher({
      root: document.body,
      selector: '[data-help-id]',
      onAdded,
      onRemoved: jest.fn(),
    });
    watcher.disconnect();

    const el = document.createElement('button');
    el.setAttribute('data-help-id', 'y');
    document.body.appendChild(el);
    await tick();

    expect(onAdded).not.toHaveBeenCalled();
  });
});
