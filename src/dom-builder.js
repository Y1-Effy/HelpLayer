/**
 * Factory functions that create the DOM elements for markers, popups, and the blocking layer.
 * Event wiring and positioning are not done here (that is the caller's responsibility).
 *
 * Accessibility:
 * - Markers are <button> elements so they are focusable and can be activated with Enter/Space.
 * - The popup uses role="dialog" + aria-labelledby (the title element) to describe itself to assistive tech.
 */

const POPUP_TITLE_ID = 'help-layer-popup-title';

export function createBlockingLayer() {
  const layer = document.createElement('div');
  layer.className = 'help-layer-blocking-layer';
  return layer;
}

/**
 * @param {string} title description title used for the assistive-tech label
 * @param {string} [label] character shown on the marker (default '?'). Visual only; does not affect the aria-label.
 */
export function createMarker(title, label = '?') {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'help-layer-marker';
  marker.textContent = label;
  marker.setAttribute('aria-label', `Help: ${title}`);
  return marker;
}

/**
 * Create the single popup shared across the whole library.
 * Also returns references to titleEl/textEl (used to update the content) and the close button closeEl.
 */
export function createPopup() {
  const root = document.createElement('div');
  root.className = 'help-layer-popup';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-labelledby', POPUP_TITLE_ID);
  root.tabIndex = -1;

  const titleEl = document.createElement('div');
  titleEl.className = 'help-layer-popup__title';
  titleEl.id = POPUP_TITLE_ID;

  const textEl = document.createElement('div');
  textEl.className = 'help-layer-popup__text';

  // Explicit close affordance. Wiring the click is popup.js's job (only element creation here).
  const closeEl = document.createElement('button');
  closeEl.type = 'button';
  closeEl.className = 'help-layer-popup__close';
  closeEl.textContent = '×';
  closeEl.setAttribute('aria-label', 'Close');

  root.append(titleEl, textEl, closeEl);

  return { root, titleEl, textEl, closeEl };
}
