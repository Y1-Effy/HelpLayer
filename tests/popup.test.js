/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const anchorUpdate = jest.fn();
const anchorCleanup = jest.fn();
const anchorPopup = jest.fn(() => ({ update: anchorUpdate, cleanup: anchorCleanup }));
jest.unstable_mockModule('../src/floating.js', () => ({
  anchorPopup,
  makeVirtualElement: jest.fn(),
  watchReference: jest.fn(() => jest.fn()),
  isFixedReference: jest.fn(() => false),
  isReferenceHidden: jest.fn(() => false),
}));

const { createPopupController } = await import('../src/popup.js');
const { createState } = await import('../src/state.js');

beforeEach(() => {
  anchorUpdate.mockClear();
  anchorCleanup.mockClear();
  anchorPopup.mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const record = { id: 'r1', title: 'Title', text: 'Body' };

describe('createPopupController', () => {
  it('sets content, shows and focuses on open, and anchors to the target', () => {
    const state = createState();
    const popup = createPopupController(state);
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);

    expect(popup.root.style.display).toBe('block');
    // The display toggle is set with !important so a host rule can't hide the open popup.
    expect(popup.root.style.getPropertyPriority('display')).toBe('important');
    expect(popup.root.querySelector('.help-layer-popup__title').textContent).toBe('Title');
    expect(popup.isOpen('r1')).toBe(true);
    expect(popup.getOpenId()).toBe('r1');
    expect(anchorPopup).toHaveBeenCalledWith(marker, popup.root, 'bottom-start');
    expect(document.activeElement).toBe(popup.root);
  });

  it('closes when the close (×) button is clicked', () => {
    const state = createState();
    const popup = createPopupController(state);
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);
    expect(popup.getOpenId()).toBe('r1');

    const closeBtn = popup.root.querySelector('.help-layer-popup__close');
    closeBtn.click();

    expect(popup.getOpenId()).toBeNull();
    expect(popup.root.style.display).toBe('none');
  });

  it('replaces the body with what render returns when it returns a Node', () => {
    const link = document.createElement('a');
    link.href = 'https://example.com';
    link.textContent = 'Learn more';
    const render = jest.fn(() => link);

    const state = createState();
    const popup = createPopupController(state, { render });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);

    expect(render).toHaveBeenCalledWith(record);
    const textEl = popup.root.querySelector('.help-layer-popup__text');
    expect(textEl.querySelector('a')).toBe(link);
    expect(textEl.textContent).toBe('Learn more');
  });

  it('falls back to safe text rendering for the body when there is no render', () => {
    const state = createState();
    const popup = createPopupController(state, { render: () => null });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);

    const textEl = popup.root.querySelector('.help-layer-popup__text');
    expect(textEl.textContent).toBe('Body');
    expect(textEl.querySelector('*')).toBeNull();
  });

  it('passes popupPlacement to anchorPopup', () => {
    const state = createState();
    const popup = createPopupController(state, { popupPlacement: 'right-start' });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);

    expect(anchorPopup).toHaveBeenCalledWith(marker, popup.root, 'right-start');
  });

  it('on close, detaches the anchor, hides, and returns focus to the trigger', () => {
    const state = createState();
    const popup = createPopupController(state);
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);
    popup.close();

    expect(popup.root.style.display).toBe('none');
    expect(popup.getOpenId()).toBeNull();
    expect(anchorCleanup).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(marker);
  });

  it('can pass an explicit focus-return target to close (#5)', () => {
    const state = createState();
    const popup = createPopupController(state);
    const marker = document.createElement('button');
    const toggle = document.createElement('button');
    document.body.append(marker, toggle);

    popup.open(record, marker);
    popup.close(toggle);

    expect(document.activeElement).toBe(toggle);
  });

  it('reposition updates the anchor only while open (#2)', () => {
    const state = createState();
    const popup = createPopupController(state);
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.reposition();
    expect(anchorUpdate).not.toHaveBeenCalled();

    popup.open(record, marker);
    popup.reposition();
    expect(anchorUpdate).toHaveBeenCalledTimes(1);
  });

  it('removes the popup on teardown', () => {
    const state = createState();
    createPopupController(state);
    expect(document.querySelector('.help-layer-popup')).not.toBeNull();

    state.teardownAll();
    expect(document.querySelector('.help-layer-popup')).toBeNull();
  });

  it('onClose fires on close and on "teardown while open", but not when never opened', () => {
    const onClose = jest.fn();
    const state = createState();
    const popup = createPopupController(state, { onClose });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    // fires on close
    popup.open(record, marker);
    popup.close();
    expect(onClose).toHaveBeenCalledTimes(1);

    // fires on teardown while open
    popup.open(record, marker);
    state.teardownAll();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not fire onClose when tearing down without ever opening', () => {
    const onClose = jest.fn();
    const state = createState();
    createPopupController(state, { onClose });

    state.teardownAll();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still removes the popup on teardown when a user onClose throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = jest.fn(() => { throw new Error('user bug'); });
    const state = createState();
    const popup = createPopupController(state, { onClose });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    popup.open(record, marker);
    // The throwing onClose runs inside the popup's own teardown, right before root.remove().
    expect(() => state.teardownAll()).not.toThrow();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.help-layer-popup')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('[help-layer] onClose threw:', expect.any(Error));

    errorSpy.mockRestore();
  });

  it('falls back to safe text rendering when render throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const render = jest.fn(() => { throw new Error('render bug'); });
    const state = createState();
    const popup = createPopupController(state, { render });
    const marker = document.createElement('button');
    document.body.appendChild(marker);

    expect(() => popup.open(record, marker)).not.toThrow();

    // The popup still opens, falling back to the safe textContent path.
    expect(popup.root.style.display).toBe('block');
    expect(popup.isOpen('r1')).toBe(true);
    const textEl = popup.root.querySelector('.help-layer-popup__text');
    expect(textEl.textContent).toBe('Body');
    expect(textEl.querySelector('*')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('[help-layer] render threw:', expect.any(Error));

    errorSpy.mockRestore();
  });

  it('gives each popup a unique title id so two instances on one page do not collide', () => {
    const state = createState();
    const first = createPopupController(state);
    const second = createPopupController(state);

    const firstTitle = first.root.querySelector('.help-layer-popup__title');
    const secondTitle = second.root.querySelector('.help-layer-popup__title');

    // Distinct ids: a duplicate id would be invalid HTML and make aria-labelledby ambiguous.
    expect(firstTitle.id).not.toBe(secondTitle.id);
    // Each popup's aria-labelledby must point at its own title element.
    expect(first.root.getAttribute('aria-labelledby')).toBe(firstTitle.id);
    expect(second.root.getAttribute('aria-labelledby')).toBe(secondTitle.id);
  });

  it('marks the dialog as a modal (aria-modal) for assistive tech', () => {
    const state = createState();
    const popup = createPopupController(state);
    expect(popup.root.getAttribute('role')).toBe('dialog');
    expect(popup.root.getAttribute('aria-modal')).toBe('true');
  });
});
