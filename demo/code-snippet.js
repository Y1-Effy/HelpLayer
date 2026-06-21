/**
 * Demo-only "show the code" helper, shared by the Vanilla / React / Vue demos. Each feature card can
 * reveal the minimal code that produces it (a collapsible <details>) with a one-click copy button, so a
 * visitor evaluating the library can see exactly how little code it takes — in each framework's idiom.
 *
 * Styling is injected once from here (id-guarded) so the three demos share one source without touching
 * demo.css / framework-demo.css. Copy uses the local Clipboard API (works on https and localhost, both
 * secure contexts) with a textarea fallback — no network involved, keeping the demo fully local.
 */

const STYLE_ID = 'hl-code-style';

const CSS = `
.demo-code {
  margin-top: 14px;
  border: 1px solid #d7dde3;
  border-radius: 6px;
  background: #0f172a;
  overflow: hidden;
}
.demo-code > summary {
  cursor: pointer;
  list-style: none;
  padding: 8px 12px;
  font: 600 12px/1.4 sans-serif;
  color: #e2e8f0;
  background: #1e293b;
  user-select: none;
}
.demo-code > summary::-webkit-details-marker { display: none; }
.demo-code > summary::before { content: '▸ '; }
.demo-code[open] > summary::before { content: '▾ '; }
.demo-code__body { position: relative; }
.demo-code__copy {
  position: absolute;
  top: 8px;
  right: 8px;
  appearance: none;
  border: 1px solid #475569;
  border-radius: 4px;
  background: #334155;
  color: #e2e8f0;
  font: 600 11px/1 sans-serif;
  padding: 5px 9px;
  cursor: pointer;
}
.demo-code__copy:hover { background: #475569; }
.demo-code pre {
  margin: 0;
  /* Extra top padding so the absolutely-positioned copy button never overlaps the first line of code. */
  padding: 36px 14px 12px;
  overflow-x: auto;
  color: #e2e8f0;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
`;

export function injectCodeStyleOnce() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Copy text to the clipboard, returning a promise that resolves to true on success.
 * Falls back to a temporary textarea + execCommand when the async Clipboard API is unavailable.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below (e.g. permission denied).
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Build a collapsible code block (Vanilla helper). Returns the structure with empty labels so the
 * caller can set/update the summary and copy-button text per language and wire the click itself.
 * React/Vue reuse the same `.demo-code` markup in their own templates and call copyText directly.
 * @param {string} code the code to show and copy
 * @returns {{ details: HTMLDetailsElement, summary: HTMLElement, copyBtn: HTMLButtonElement }}
 */
export function createCodeBlock(code) {
  injectCodeStyleOnce();
  const details = document.createElement('details');
  details.className = 'demo-code';

  const summary = document.createElement('summary');

  const body = document.createElement('div');
  body.className = 'demo-code__body';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'demo-code__copy';

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);

  body.append(copyBtn, pre);
  details.append(summary, body);
  return { details, summary, copyBtn };
}
