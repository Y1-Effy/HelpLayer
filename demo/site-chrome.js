/**
 * Demo-only site chrome shared by the Vanilla / React / Vue pages: a footer that gives an evaluator a
 * clear adoption path once the demo has done its job. It shows the key value props (chips), an
 * accessibility "try the keyboard" note, copy-paste install commands, and links out to GitHub / npm /
 * docs. Without this, the hosted demo has no way to act on interest.
 *
 * It's appended to <body> (outside any framework root) so it never interferes with React/Vue mounting
 * or unmounting, and styles are injected once (id-guarded). External URLs are plain links — they only
 * navigate on click, so the page still makes zero network requests on load.
 */
import { copyText } from './code-snippet.js';
import { showcaseStrings } from './showcase-i18n.js';

const STYLE_ID = 'hl-footer-style';

const NPM_CMD = 'npm install help-layer';
const SCRIPT_TAG = '<script src="https://unpkg.com/help-layer@1.0.1/dist/help-layer.iife.js"></script>';
const LINKS = {
  github: 'https://github.com/Y1-Effy/HelpLayer',
  npm: 'https://www.npmjs.com/package/help-layer',
  docs: 'https://github.com/Y1-Effy/HelpLayer#readme',
};

const CSS = `
.demo-footer {
  max-width: 720px;
  margin: 32px auto 96px;
  padding: 20px 24px;
  box-sizing: border-box;
  border-top: 1px solid #d7dde3;
  font-family: sans-serif;
  color: #1f2933;
}
.demo-footer__chips {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 14px;
  padding: 0;
}
.demo-footer__chips li {
  background: #eef2f7;
  border: 1px solid #d7dde3;
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.demo-footer__a11y {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}
.demo-footer__install-label {
  font-size: 12px;
  font-weight: 700;
  color: #52606d;
  margin: 0 0 6px;
}
.demo-footer__code {
  position: relative;
  margin-bottom: 8px;
  background: #0f172a;
  border-radius: 6px;
  overflow: hidden;
}
.demo-footer__code code {
  display: block;
  padding: 10px 78px 10px 12px;
  overflow-x: auto;
  white-space: pre;
  color: #e2e8f0;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.demo-footer__copy {
  position: absolute;
  top: 6px;
  right: 6px;
  appearance: none;
  border: 1px solid #475569;
  border-radius: 4px;
  background: #334155;
  color: #e2e8f0;
  font: 600 11px/1 sans-serif;
  padding: 5px 9px;
  cursor: pointer;
}
.demo-footer__copy:hover { background: #475569; }
.demo-footer__links {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  font-size: 13px;
}
.demo-footer__links a { color: #0f6bff; text-decoration: none; font-weight: 600; }
.demo-footer__links a:hover { text-decoration: underline; }
`;

function injectStyleOnce() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Mount the shared footer. Returns a handle to update its language.
 * @param {'en'|'ja'} lang
 * @returns {{ setLang(lang: 'en'|'ja'): void }}
 */
export function mountSiteChrome(lang) {
  injectStyleOnce();
  let strings = showcaseStrings(lang);

  // Guard against a duplicate footer (e.g. an accidental double mount under React StrictMode):
  // reuse the existing one if present.
  const existing = document.querySelector('footer.demo-footer');
  if (existing) {
    existing.remove();
  }

  const footer = document.createElement('footer');
  footer.className = 'demo-footer';

  const chips = document.createElement('ul');
  chips.className = 'demo-footer__chips';

  const a11y = document.createElement('p');
  a11y.className = 'demo-footer__a11y';

  const installLabel = document.createElement('p');
  installLabel.className = 'demo-footer__install-label';

  /** Build one copyable code line; the copy button label tracks the current language. */
  function codeLine(text) {
    const wrap = document.createElement('div');
    wrap.className = 'demo-footer__code';
    const code = document.createElement('code');
    code.textContent = text;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-footer__copy';
    let timer = 0;
    btn.addEventListener('click', async() => {
      const ok = await copyText(text);
      btn.textContent = ok ? strings.copied : strings.copy;
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = strings.copy;
      }, 1200);
    });
    wrap.append(code, btn);
    return btn;
  }

  const npmCopy = codeLine(NPM_CMD);
  const scriptCopy = codeLine(SCRIPT_TAG);

  const links = document.createElement('nav');
  links.className = 'demo-footer__links';
  links.setAttribute('aria-label', 'HelpLayer links');
  const mkLink = (href) => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };
  const ghLink = mkLink(LINKS.github);
  const npmLink = mkLink(LINKS.npm);
  const docsLink = mkLink(LINKS.docs);
  links.append(ghLink, npmLink, docsLink);

  // Append install lines (code wraps) — grab their parents to mount in order.
  footer.append(chips, a11y, installLabel, npmCopy.parentElement, scriptCopy.parentElement, links);
  document.body.appendChild(footer);

  function render() {
    chips.textContent = '';
    for (const chip of strings.valueChips) {
      const li = document.createElement('li');
      li.textContent = chip;
      chips.appendChild(li);
    }
    a11y.textContent = strings.a11yNote;
    installLabel.textContent = strings.installTitle;
    npmCopy.textContent = strings.copy;
    scriptCopy.textContent = strings.copy;
    ghLink.textContent = strings.linkGitHub;
    npmLink.textContent = strings.linkNpm;
    docsLink.textContent = strings.linkDocs;
  }

  render();

  return {
    setLang(next) {
      strings = showcaseStrings(next);
      render();
    },
  };
}
