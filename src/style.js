/**
 * The z-index constants help-layer uses, and the CSS it injects.
 * Things that must sit above the blocking layer use Z_TOP (markers); the popup uses Z_POPUP so it
 * always paints in front of the markers (they share a stacking context as <body> children, so a tie
 * would otherwise be decided by DOM order and a remounted marker could cover an open popup).
 * The toggle is made visible through the clip-path "hole", so its z-index is left untouched.
 */
export const Z_BLOCKING_LAYER = 2147483000;
export const Z_TOP = 2147483001;
export const Z_POPUP = 2147483002;

const STYLE_ATTR = 'data-help-layer-style';

// The theme is fully exposed via CSS custom properties. Users can change the look just by
// overriding the following variables in host-side CSS (e.g. :root or any scope):
//   --help-layer-marker-size       marker diameter (default 24px, WCAG 2.5.8 minimum target size)
//   --help-layer-marker-bg         marker background color (default #2563eb)
//   --help-layer-marker-color      marker text color (default #fff)
//   --help-layer-popup-bg          popup background color (default #fff)
//   --help-layer-popup-color       popup text color (default #1f2933)
//   --help-layer-popup-max-width   popup max width (default 280px)
//   --help-layer-popup-max-height  body max height (default 50vh, scrolls when exceeded)
//   --help-layer-accent            focus ring color (default #1d4ed8)
//   --help-layer-overlay-bg        blocking-layer (scrim) background (default transparent; e.g. rgba(0,0,0,0.15))
//   --help-layer-overlay-cursor    cursor over the blocked area (default default; e.g. not-allowed / help)
const CSS = `
.help-layer-blocking-layer {
  /* Structural properties !important so a host can't accidentally un-fix or restack the layer and
     defeat the blocking guarantee. */
  position: fixed !important;
  inset: 0 !important;
  pointer-events: auto !important;
  /* Default transparent (unchanged). Set --help-layer-overlay-bg to tint it into a scrim that signals
     "the host app is inactive". The clip-path hole isn't painted, so the toggle stays untinted. */
  background: var(--help-layer-overlay-bg, transparent);
  /* Cursor over the blocked area only (the toggle shows through the hole and keeps its own cursor).
     e.g. not-allowed / help makes "this won't respond" obvious without needing a tint. */
  cursor: var(--help-layer-overlay-cursor, default);
  z-index: ${Z_BLOCKING_LAYER} !important;
}

.help-layer-marker {
  /* reset of the button element */
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 0;
  border: none;
  /* Structural properties are !important so a host's broad rules (e.g. button { display:none }) can't
     hide or distort the marker. top/left stay non-important because place() writes them inline per
     frame; !important there would override that and pin the marker to 0,0. Theme stays var()-driven.
     Note: for targets in a position:fixed subtree, floating.js overrides this with an inline
     position:fixed !important (inline important beats this rule) so the marker doesn't jitter. */
  position: absolute !important;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  top: 0;
  left: 0;
  width: var(--help-layer-marker-size, 24px) !important;
  height: var(--help-layer-marker-size, 24px) !important;
  border-radius: 50%;
  background: var(--help-layer-marker-bg, #2563eb);
  color: var(--help-layer-marker-color, #fff);
  font-family: sans-serif;
  font-size: 13px;
  font-weight: bold;
  line-height: var(--help-layer-marker-size, 24px);
  text-align: center;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  z-index: ${Z_TOP} !important;
}

.help-layer-marker:focus-visible {
  outline: 3px solid var(--help-layer-accent, #1d4ed8);
  outline-offset: 2px;
}

.help-layer-popup {
  /* Structural !important guards against host resets; top/left stay inline (place()), and display is
     deliberately NOT !important here — popup.js toggles it via an inline !important declaration so the
     open/close state itself can also beat a host rule without this stylesheet fighting the toggle. */
  position: absolute !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  top: 0;
  left: 0;
  display: none;
  max-width: var(--help-layer-popup-max-width, 280px);
  background: var(--help-layer-popup-bg, #fff);
  color: var(--help-layer-popup-color, #1f2933);
  border-radius: 6px;
  padding: 12px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  font-family: sans-serif;
  font-size: 13px;
  line-height: 1.5;
  z-index: ${Z_POPUP} !important;
}

.help-layer-popup:focus {
  outline: none;
}

.help-layer-popup:focus-visible {
  outline: 3px solid var(--help-layer-accent, #1d4ed8);
  outline-offset: 2px;
}

.help-layer-popup__title {
  font-weight: bold;
  margin-bottom: 4px;
  /* Reserve space so it doesn't overlap the × button at the top-right. */
  padding-right: 16px;
}

.help-layer-popup__text {
  /* Render the body's \n as line breaks (still textContent, so no XSS risk). */
  white-space: pre-line;
  /* Keep long text from spilling off-screen; only the body scrolls within the popup. */
  max-height: var(--help-layer-popup-max-height, 50vh);
  overflow-y: auto;
}

.help-layer-popup__close {
  /* reset of the button element */
  appearance: none;
  -webkit-appearance: none;
  /* Keep the close affordance visible/placed even under host button { ... } rules. */
  display: block !important;
  position: absolute !important;
  pointer-events: auto !important;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.help-layer-popup__close:hover {
  background: rgba(0, 0, 0, 0.08);
}

.help-layer-popup__close:focus-visible {
  outline: 2px solid var(--help-layer-accent, #1d4ed8);
  outline-offset: 1px;
}

/*
 * Show an outline on the target element only while the marker is hovered/focused (clarifies "which element this explains").
 * Make only the outline !important so it can beat host-side outline resets.
 */
.help-layer-target-highlight {
  outline: 2px solid var(--help-layer-accent, #1d4ed8) !important;
  outline-offset: 2px !important;
}

/*
 * Dark-mode defaults. If the user specifies CSS variables, those always win via var(), so here we
 * only swap the dark fallback values (the properties themselves aren't re-declared).
 */
@media (prefers-color-scheme: dark) {
  .help-layer-popup {
    background: var(--help-layer-popup-bg, #1f2933);
    color: var(--help-layer-popup-color, #e5e7eb);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55);
  }
}
`;

/**
 * Inject a <style> tag into head and return that element.
 * @param {string} [nonce] nonce to allow this <style> under a strict CSP (style-src 'nonce-…').
 *   The nonce attribute is added only when provided. If omitted, nothing is added (as before).
 */
export function injectStyles(nonce) {
  const styleEl = document.createElement('style');
  styleEl.setAttribute(STYLE_ATTR, '');
  // Under a CSP running style-src 'nonce-…', only a <style> with a matching nonce is applied.
  if (nonce) {
    styleEl.setAttribute('nonce', nonce);
  }
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  return styleEl;
}

/**
 * Remove the <style> tag injected by injectStyles().
 */
export function removeStyles(styleEl) {
  styleEl.remove();
}
