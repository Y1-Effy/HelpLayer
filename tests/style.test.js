/** @jest-environment jsdom */
import { injectStyles, removeStyles } from '../src/style.js';

afterEach(() => {
  document.head.querySelectorAll('[data-help-layer-style]').forEach((el) => el.remove());
});

describe('injectStyles', () => {
  it('injects theme CSS custom properties with default values', () => {
    const styleEl = injectStyles();
    const css = styleEl.textContent;

    // The user-overridable variables should be referenced with a fallback.
    for (const variable of [
      '--help-layer-marker-size',
      '--help-layer-marker-bg',
      '--help-layer-marker-color',
      '--help-layer-popup-bg',
      '--help-layer-popup-color',
      '--help-layer-popup-max-width',
      '--help-layer-accent',
      '--help-layer-overlay-bg',
      '--help-layer-overlay-cursor',
    ]) {
      expect(css).toContain(`var(${variable},`);
    }

    removeStyles(styleEl);
  });

  it('includes the body line-break rendering (pre-line) and the dark-mode media query', () => {
    const styleEl = injectStyles();
    const css = styleEl.textContent;

    expect(css).toContain('white-space: pre-line');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    // Even in dark mode, the user's override should win via var().
    expect(css).toContain('var(--help-layer-popup-bg,');

    removeStyles(styleEl);
  });

  it('adds a nonce attribute to the injected <style> when nonce is given (strict-CSP support)', () => {
    const styleEl = injectStyles('abc123');

    expect(styleEl.getAttribute('nonce')).toBe('abc123');

    removeStyles(styleEl);
  });

  it('does not add a nonce attribute when nonce is omitted (as before)', () => {
    const styleEl = injectStyles();

    expect(styleEl.hasAttribute('nonce')).toBe(false);

    removeStyles(styleEl);
  });

  it('removes the <style> via removeStyles', () => {
    const styleEl = injectStyles();
    expect(document.head.querySelector('[data-help-layer-style]')).not.toBeNull();

    removeStyles(styleEl);
    expect(document.head.querySelector('[data-help-layer-style]')).toBeNull();
  });
});
