/**
 * Factory functions that create the DOM elements for markers, popups, and the blocking layer.
 * Event wiring and positioning are not done here (that is the caller's responsibility).
 *
 * Accessibility:
 * - Markers are <button> elements so they are focusable and can be activated with Enter/Space.
 * - The popup uses role="dialog" + aria-labelledby (the title element) so assistive tech announces it,
 *   plus aria-describedby (the body element) so the description text is read out, not just the title.
 */

// Each initHelpLayer instance builds its own popup; a fixed id would collide when the
// library is initialized more than once on a page (invalid duplicate id + ambiguous
// aria-labelledby). Hand out a unique id per popup instead.
let popupSeq = 0;

export function createBlockingLayer() {
  const layer = document.createElement('div');
  layer.className = 'help-layer-blocking-layer';
  return layer;
}

/**
 * @param {string} title description title used for the assistive-tech label
 * @param {string} [label] character shown on the marker (default '?'). Visual only; does not affect the aria-label.
 * @param {string} [ariaLabel] full aria-label for the marker (default `Help: ${title}`). Lets callers
 *   localize the assistive-tech announcement; falls back to the English default when omitted.
 */
export function createMarker(title, label = '?', ariaLabel = `Help: ${title}`) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'help-layer-marker';
  marker.textContent = label;
  marker.setAttribute('aria-label', ariaLabel);
  return marker;
}

/**
 * Create the single popup shared across the whole library.
 * Also returns references to titleEl/textEl (used to update the content) and the close button closeEl.
 * @param {string} [closeLabel] aria-label for the close (×) button (default 'Close'). Lets callers
 *   localize the assistive-tech announcement; falls back to the English default when omitted.
 */
export function createPopup(closeLabel = 'Close') {
  // One sequence value per popup, shared by the title and body ids (then advanced once), so two
  // instances on a page never collide on either id.
  const seq = popupSeq++;
  const titleId = `help-layer-popup-title-${seq}`;
  const textId = `help-layer-popup-text-${seq}`;

  const root = document.createElement('div');
  root.className = 'help-layer-popup';
  root.setAttribute('role', 'dialog');
  // aria-modal tells AT that content outside the dialog is inert while it's shown (the host is also
  // inert'd at the document level during help mode). Harmless when hidden: display:none drops the
  // popup from the a11y tree.
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', titleId);
  // Point at the body container (not its contents) so the description is announced even after a custom
  // render swaps the body's children — the container id stays stable.
  root.setAttribute('aria-describedby', textId);
  root.tabIndex = -1;

  const titleEl = document.createElement('div');
  titleEl.className = 'help-layer-popup__title';
  titleEl.id = titleId;

  const textEl = document.createElement('div');
  textEl.className = 'help-layer-popup__text';
  textEl.id = textId;

  // Explicit close affordance. Wiring the click is popup.js's job (only element creation here).
  const closeEl = document.createElement('button');
  closeEl.type = 'button';
  closeEl.className = 'help-layer-popup__close';
  closeEl.textContent = '×';
  closeEl.setAttribute('aria-label', closeLabel);

  root.append(titleEl, textEl, closeEl);

  return { root, titleEl, textEl, closeEl };
}
