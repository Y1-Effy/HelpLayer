/**
 * Tiny i18n helper shared by the demos (English / Japanese).
 *
 * This is demo-only sugar — the HelpLayer library itself is not involved. The chosen language is
 * persisted in localStorage so it carries across the Vanilla / React / Vue pages, and the default
 * is English (matching the English-first README).
 */

const STORAGE_KEY = 'help-layer-demo-lang';
export const SUPPORTED_LANGS = ['en', 'ja'];
const DEFAULT_LANG = 'en';

/** Read the persisted language, falling back to English when unset/invalid. */
export function getLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      return saved;
    }
  } catch {
    // localStorage can throw in private mode / sandboxed contexts — just use the default.
  }
  return DEFAULT_LANG;
}

/** Persist the language and reflect it on <html lang>. */
export function setLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore persistence failures (still applies for the current page via the caller).
  }
  document.documentElement.lang = lang;
}

const LANG_LABELS = { en: 'EN', ja: '日本語' };

/**
 * Build a language switcher (a small button group). The caller decides where to place it and what
 * happens on change.
 * @param {string} current currently active language
 * @param {(lang: string) => void} onChange called with the newly selected language
 * @returns {HTMLElement}
 */
export function createLangSwitcher(current, onChange) {
  const group = document.createElement('div');
  group.className = 'demo-lang';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Language');

  for (const lang of SUPPORTED_LANGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-lang__btn';
    btn.dataset.lang = lang;
    btn.textContent = LANG_LABELS[lang];
    btn.setAttribute('aria-pressed', String(lang === current));
    btn.addEventListener('click', () => onChange(lang));
    group.appendChild(btn);
  }
  return group;
}

/** Update a switcher's pressed state after the language changed. */
export function syncLangSwitcher(group, current) {
  group.querySelectorAll('.demo-lang__btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === current));
  });
}
