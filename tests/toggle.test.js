/** @jest-environment jsdom */
import { jest } from '@jest/globals';

// We don't need real DOM layout for placement, so mock floating.js.
jest.unstable_mockModule('../src/floating.js', () => ({
  anchorMarker: jest.fn(() => jest.fn()),
  anchorPopup: jest.fn(() => ({ update: jest.fn(), cleanup: jest.fn() })),
  makeVirtualElement: jest.fn((getRect) => ({ getBoundingClientRect: getRect })),
  watchReference: jest.fn(() => jest.fn()),
}));

const { createToggleController } = await import('../src/toggle.js');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const config = {
  save: { title: 'Save', text: 'Description of the save button' },
  free1: { title: 'Free', text: 'Description of the free placement', position: { top: 50, left: 80 } },
};

let toggleEl;

beforeEach(() => {
  // Don't actually fire markers' overlap-avoidance rAF (just return an id).
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();

  document.body.innerHTML = '';
  document.head.querySelectorAll('[data-help-layer-style]').forEach((el) => el.remove());

  toggleEl = document.createElement('button');
  toggleEl.id = 'toggle';
  document.body.appendChild(toggleEl);

  const target = document.createElement('button');
  target.setAttribute('data-help-id', 'save');
  document.body.appendChild(target);
});

const markerCount = () => document.querySelectorAll('.help-layer-marker').length;

describe('createToggleController', () => {
  it('toggle click turns ON: creates markers, blocking layer, and styles', () => {
    const controller = createToggleController({ config, toggle: toggleEl });

    toggleEl.click();

    // element-bound (save) + free placement (free1) = 2
    expect(markerCount()).toBe(2);
    expect(document.querySelector('.help-layer-blocking-layer')).not.toBeNull();
    expect(document.querySelector('.help-layer-popup')).not.toBeNull();
    expect(document.head.querySelector('[data-help-layer-style]')).not.toBeNull();

    controller.destroy();
  });

  it('re-click turns OFF: cleans up everything it created', () => {
    const controller = createToggleController({ config, toggle: toggleEl });

    toggleEl.click(); // ON
    toggleEl.click(); // OFF

    expect(markerCount()).toBe(0);
    expect(document.querySelector('.help-layer-blocking-layer')).toBeNull();
    expect(document.querySelector('.help-layer-popup')).toBeNull();
    expect(document.head.querySelector('[data-help-layer-style]')).toBeNull();

    controller.destroy();
  });

  it('after OFF, no MutationObserver lingers and it does not react to host DOM additions (no-footprint regression)', async() => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.enable();
    controller.disable();

    // Even if the host adds a data-help-id element after OFF, no marker appears if observation was severed.
    // = a guarantee that while the mode is OFF the library does not react to host DOM changes at all.
    const added = document.createElement('button');
    added.setAttribute('data-help-id', 'save');
    document.body.appendChild(added);
    await tick();

    expect(markerCount()).toBe(0);
    expect(document.querySelector('.help-layer-blocking-layer')).toBeNull();
    expect(document.head.querySelector('[data-help-layer-style]')).toBeNull();

    controller.destroy();
  });

  it('dynamically adds a marker to a data-help-id element added while ON', async() => {
    const controller = createToggleController({ config, toggle: toggleEl });
    toggleEl.click();
    expect(markerCount()).toBe(2);

    const added = document.createElement('button');
    added.setAttribute('data-help-id', 'save');
    document.body.appendChild(added);
    await tick();

    expect(markerCount()).toBe(3);

    controller.destroy();
  });

  it('removes the marker of an element removed while ON', async() => {
    const controller = createToggleController({ config, toggle: toggleEl });
    const target = document.querySelector('[data-help-id="save"]');
    toggleEl.click();
    expect(markerCount()).toBe(2);

    target.remove();
    await tick();

    expect(markerCount()).toBe(1); // only the free placement remains

    controller.destroy();
  });

  it('closes the open popup when its target element is removed while ON', async() => {
    const onClose = jest.fn();
    const controller = createToggleController({ config, toggle: toggleEl, onClose });
    const target = document.querySelector('[data-help-id="save"]');
    controller.enable();
    controller.open('save');
    expect(document.querySelector('.help-layer-popup').style.display).toBe('block');

    target.remove();
    await tick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.help-layer-popup').style.display).toBe('none');
    expect(markerCount()).toBe(1); // only the free placement remains

    controller.destroy();
  });

  it('enable() is idempotent: a second call does not re-mount the subsystems', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.enable();
    expect(markerCount()).toBe(2);

    controller.enable(); // no-op while already ON

    expect(markerCount()).toBe(2); // not doubled
    expect(document.querySelectorAll('.help-layer-blocking-layer')).toHaveLength(1);

    controller.destroy();
  });

  it('Escape disables the mode when no popup is open', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.enable();
    expect(controller.isActive()).toBe(true);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    expect(controller.isActive()).toBe(false);
    expect(markerCount()).toBe(0);

    controller.destroy();
  });

  it('Escape only closes the open popup, keeping the mode ON', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.enable();
    controller.open('save');
    expect(document.querySelector('.help-layer-popup').style.display).toBe('block');

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    expect(document.querySelector('.help-layer-popup').style.display).toBe('none');
    expect(controller.isActive()).toBe(true);

    controller.destroy();
  });

  it('clicking the blocking layer background closes the open popup', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.enable();
    controller.open('save');
    expect(document.querySelector('.help-layer-popup').style.display).toBe('block');

    document.querySelector('.help-layer-blocking-layer').click();

    expect(document.querySelector('.help-layer-popup').style.display).toBe('none');
    expect(controller.isActive()).toBe(true);

    controller.destroy();
  });

  it('warns about and ignores an unregistered data-help-id', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ghost = document.createElement('button');
    ghost.setAttribute('data-help-id', 'ghost');
    document.body.appendChild(ghost);

    const controller = createToggleController({ config, toggle: toggleEl });
    toggleEl.click();

    expect(markerCount()).toBe(2); // no marker is attached to ghost
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ghost'));

    controller.destroy();
    warnSpy.mockRestore();
  });

  it('does not turn ON via toggle click after destroy', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    controller.destroy();

    toggleEl.click();

    expect(markerCount()).toBe(0);
  });

  it('throws on an invalid config', () => {
    expect(() => createToggleController({ config: { x: { title: '' } }, toggle: toggleEl })).toThrow();
  });

  it('throws when the toggle is not found', () => {
    expect(() => createToggleController({ config, toggle: '#missing' })).toThrow();
  });

  it('throws a clear error when called without an options object', () => {
    expect(() => createToggleController()).toThrow(/options object/);
    expect(() => createToggleController(null)).toThrow(/options object/);
  });

  it('throws when toggle is neither a selector string nor a DOM element', () => {
    expect(() => createToggleController({ config, toggle: 5 })).toThrow(/toggle must be/);
    expect(() => createToggleController({ config, toggle: {} })).toThrow(/toggle must be/);
  });

  it('accepts a DOM element as the toggle', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    toggleEl.click();
    expect(controller.isActive()).toBe(true);
    controller.destroy();
  });

  it('can be controlled programmatically via enable/disable/isActive', () => {
    const controller = createToggleController({ config, toggle: toggleEl });

    expect(controller.isActive()).toBe(false);
    controller.enable();
    expect(controller.isActive()).toBe(true);
    expect(markerCount()).toBe(2);

    controller.disable();
    expect(controller.isActive()).toBe(false);
    expect(markerCount()).toBe(0);

    controller.destroy();
  });

  it('can be turned ON/OFF programmatically even when toggle is omitted', () => {
    const controller = createToggleController({ config });

    controller.enable();
    expect(markerCount()).toBe(2);
    // The blocking layer still appears without a toggle (full-surface blocking).
    expect(document.querySelector('.help-layer-blocking-layer')).not.toBeNull();

    controller.disable();
    expect(markerCount()).toBe(0);

    controller.destroy();
  });

  it('fires the onEnable/onDisable callbacks', () => {
    const onEnable = jest.fn();
    const onDisable = jest.fn();
    const controller = createToggleController({ config, toggle: toggleEl, onEnable, onDisable });

    toggleEl.click(); // ON
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onDisable).not.toHaveBeenCalled();

    toggleEl.click(); // OFF
    expect(onDisable).toHaveBeenCalledTimes(1);

    controller.destroy();
  });

  it('fires onOpen on marker click and onClose on re-click', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const controller = createToggleController({ config, toggle: toggleEl, onOpen, onClose });

    toggleEl.click(); // ON
    const marker = document.querySelector('.help-layer-marker');

    marker.click(); // open
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    marker.click(); // close
    expect(onClose).toHaveBeenCalledTimes(1);

    controller.destroy();
  });

  it('fully tears down even when a user onClose throws while a popup is open', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = jest.fn(() => { throw new Error('user bug'); });
    const controller = createToggleController({ config, toggle: toggleEl, onClose });
    controller.enable();
    controller.open('save');
    expect(document.querySelector('.help-layer-popup').style.display).toBe('block');

    // destroy() -> disable() -> teardownAll(), which closes the popup (firing the throwing onClose).
    // A throw must not strand the markers, blocking layer, or injected styles.
    expect(() => controller.destroy()).not.toThrow();

    expect(controller.isActive()).toBe(false);
    expect(markerCount()).toBe(0);
    expect(document.querySelector('.help-layer-blocking-layer')).toBeNull();
    expect(document.querySelector('.help-layer-popup')).toBeNull();
    expect(document.head.querySelector('[data-help-layer-style]')).toBeNull();

    errorSpy.mockRestore();
  });

  it('a throwing onEnable/onDisable/onOpen does not break the control flow', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onEnable = jest.fn(() => { throw new Error('enable bug'); });
    const onDisable = jest.fn(() => { throw new Error('disable bug'); });
    const onOpen = jest.fn(() => { throw new Error('open bug'); });
    const controller = createToggleController({
      config, toggle: toggleEl, onEnable, onDisable, onOpen,
    });

    expect(() => controller.enable()).not.toThrow();
    expect(controller.isActive()).toBe(true);
    expect(markerCount()).toBe(2);

    expect(() => controller.open('save')).not.toThrow();
    expect(document.querySelector('.help-layer-popup').style.display).toBe('block');

    expect(() => controller.disable()).not.toThrow();
    expect(controller.isActive()).toBe(false);
    expect(markerCount()).toBe(0);

    controller.destroy();
    errorSpy.mockRestore();
  });

  it('suppresses the unregistered-key warning with silent:true', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ghost = document.createElement('button');
    ghost.setAttribute('data-help-id', 'ghost');
    document.body.appendChild(ghost);

    const controller = createToggleController({ config, toggle: toggleEl, silent: true });
    toggleEl.click();

    expect(warnSpy).not.toHaveBeenCalled();

    controller.destroy();
    warnSpy.mockRestore();
  });

  it('can swap the target attribute name via attribute', () => {
    const custom = document.createElement('button');
    custom.setAttribute('data-tip', 'save');
    document.body.appendChild(custom);

    const controller = createToggleController({ config, toggle: toggleEl, attribute: 'data-tip' });
    toggleEl.click();

    // one data-tip="save" element + free placement free1 = 2 (the default attribute data-help-id is ignored)
    expect(markerCount()).toBe(2);

    controller.destroy();
  });

  it('replaces helpConfig via update and reflects it immediately while ON', () => {
    const controller = createToggleController({ config, toggle: toggleEl });
    toggleEl.click();
    expect(markerCount()).toBe(2);

    controller.update({
      save: { title: 'Save', text: 'Description of the save button' },
      free1: { title: 'Free', text: 'Description of the free placement', position: { top: 50, left: 80 } },
      free2: { title: 'Free 2', text: 'An additional free placement', position: { top: 90, left: 120 } },
    });

    // free2 is added, making 3.
    expect(markerCount()).toBe(3);

    controller.destroy();
  });

  describe('open / close', () => {
    const popupDisplay = () => document.querySelector('.help-layer-popup').style.display;

    it('open(key) opens the description for a registered key while ON', () => {
      const onOpen = jest.fn();
      const controller = createToggleController({ config, toggle: toggleEl, onOpen });
      controller.enable();

      controller.open('save');

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0].title).toBe('Save');
      expect(popupDisplay()).toBe('block');

      controller.destroy();
    });

    it('close() hides the open description but keeps the mode ON', () => {
      const onClose = jest.fn();
      const controller = createToggleController({ config, toggle: toggleEl, onClose });
      controller.enable();
      controller.open('save');

      controller.close();

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(popupDisplay()).toBe('none');
      expect(controller.isActive()).toBe(true);

      controller.destroy();
    });

    it('open(key) auto-enables the mode when called while OFF', () => {
      const onOpen = jest.fn();
      const controller = createToggleController({ config, toggle: toggleEl, onOpen });

      expect(controller.isActive()).toBe(false);
      controller.open('save');

      expect(controller.isActive()).toBe(true);
      expect(markerCount()).toBe(2);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(popupDisplay()).toBe('block');

      controller.destroy();
    });

    it('open(key) warns and does nothing for an unregistered key', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const onOpen = jest.fn();
      const controller = createToggleController({ config, toggle: toggleEl, onOpen });
      controller.enable();

      controller.open('nope');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nope'));
      expect(onOpen).not.toHaveBeenCalled();
      // The popup was never opened, so it stays hidden (its display is left at the default, not 'block').
      expect(popupDisplay()).not.toBe('block');

      controller.destroy();
      warnSpy.mockRestore();
    });

    it('open(key) for an unregistered key stays silent with silent:true', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const controller = createToggleController({ config, toggle: toggleEl, silent: true });
      controller.enable();

      controller.open('nope');

      expect(warnSpy).not.toHaveBeenCalled();

      controller.destroy();
      warnSpy.mockRestore();
    });

    it('open(key) opens the first marker when several elements share the key', () => {
      const onOpen = jest.fn();
      const duplicate = document.createElement('button');
      duplicate.setAttribute('data-help-id', 'save');
      document.body.appendChild(duplicate);

      const controller = createToggleController({ config, toggle: toggleEl, onOpen });
      controller.enable();
      // two "save" elements + free1 = 3 markers
      expect(markerCount()).toBe(3);

      expect(() => controller.open('save')).not.toThrow();
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(popupDisplay()).toBe('block');

      controller.destroy();
    });
  });
});
