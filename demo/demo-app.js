import { initHelpLayer } from '../src/index.js';

import { buildHelpConfig } from './helpConfig.js';
import { createLangSwitcher, getLang, setLang, syncLangSwitcher } from './i18n.js';

// UI strings for the demo page (English / Japanese). Keys used as text content are matched by the
// `data-i18n` attribute in index.html; the rest are applied imperatively in applyLang().
const ui = {
  en: {
    docTitle: 'HelpLayer Demo',
    appTitle: 'Admin screen sample',
    formTitle: 'Basic form',
    usernameLabel: 'Username',
    usernameValue: 'Jane Doe',
    saveBtn: 'Save',
    scrollTitle: 'Inner scroll container',
    scrollTop: 'Dummy content at the top. Scroll down and the button appears.',
    scrollBtn: 'Button inside the scroll',
    scrollBottom: 'Dummy content at the bottom.',
    dynamicTitle: 'Dynamic elements (SPA-style)',
    dynamicDesc: 'Markers follow even when rows are added/removed while help mode is ON.',
    addRow: 'Add row',
    removeRow: 'Remove row',
    modalShadowTitle: 'Modal / Shadow DOM',
    openModal: 'Open modal',
    inlineRichTitle: 'Inline definition / rich body',
    inlineRichDesc: 'The left button has no config entry — its description comes from data attributes only. The middle shows line breaks in the body; the right uses custom rendering via render.',
    inlineBtn: 'Inline definition',
    inlineTitle: 'Inline definition',
    inlineText: 'This description is written directly in the data-help-title / data-help-text attributes. No config object needed.',
    multilineBtn: 'Multi-line description',
    richlinkBtn: 'render (link)',
    blockingTitle: 'Verifying interaction blocking',
    blockingDesc: "With help mode OFF the counter increments. While ON you can verify that interactions don't reach the host app.",
    hostClickBtn: 'Host-side click',
    keyLabel: 'Key input',
    apiTitle: 'Public API / callbacks',
    apiDesc: 'Try open / close / update from the API and watch each callback fire.',
    apiSequence: 'API sequence',
    apiTargetBtn: 'API target button',
    fixedbarBtn: 'Fixed-bar action',
    modalTitle: 'Settings modal',
    modalFieldLabel: 'Field inside the modal',
    modalValue: 'Default value',
    closeModal: 'Close',
    toggle: 'Help mode',
    toggleOn: 'Help mode (ON)',
    shadowP: 'This is inside Shadow DOM.',
    shadowBtn: 'Button inside the shadow',
    dynamicRow: 'Dynamic row',
    linkText: 'Open the Floating UI site',
    apitargetVariantTitle: 'Description updated from the API',
    apitargetVariantText: 'With update(config) you can swap the config and rebuild even while help mode is ON.',
    freeVariantTitle: 'Updated screen description',
    freeVariantText: 'This free-placement marker is also regenerated after update(config).',
  },
  ja: {
    docTitle: 'HelpLayer デモ',
    appTitle: '管理画面サンプル',
    formTitle: '基本フォーム',
    usernameLabel: 'ユーザー名',
    usernameValue: '山田太郎',
    saveBtn: '保存',
    scrollTitle: '内側スクロールコンテナ',
    scrollTop: '上部のダミー内容です。下にスクロールするとボタンが現れます。',
    scrollBtn: 'スクロール内のボタン',
    scrollBottom: '下部のダミー内容です。',
    dynamicTitle: '動的要素（SPA想定）',
    dynamicDesc: '解説モードON中に追加/削除してもマーカーが追従します。',
    addRow: '行を追加',
    removeRow: '行を削除',
    modalShadowTitle: 'モーダル / Shadow DOM',
    openModal: 'モーダルを開く',
    inlineRichTitle: 'インライン定義 / リッチ本文',
    inlineRichDesc: '左のボタンは config に書かず data 属性だけで説明を付けています。中央は本文の改行、右は render での自前描画です。',
    inlineBtn: 'インライン定義',
    inlineTitle: 'インライン定義',
    inlineText: 'この説明は data-help-title / data-help-text 属性に直接書いています。config オブジェクト不要です。',
    multilineBtn: '複数行の説明',
    richlinkBtn: 'render（リンク）',
    blockingTitle: 'イベント遮断の確認',
    blockingDesc: '解説モードOFFではカウンターが増えます。ON中はホストアプリ側の操作へ届かないことを確認できます。',
    hostClickBtn: 'ホスト側クリック',
    keyLabel: 'キー入力',
    apiTitle: '公開API / コールバック',
    apiDesc: 'APIからの open / close / update と、各コールバックの発火を確認できます。',
    apiSequence: 'APIシーケンス',
    apiTargetBtn: 'API対象ボタン',
    fixedbarBtn: '固定バーのアクション',
    modalTitle: '設定モーダル',
    modalFieldLabel: 'モーダル内の項目',
    modalValue: '設定値',
    closeModal: '閉じる',
    toggle: '解説モード',
    toggleOn: '解説モード（ON）',
    shadowP: 'これは Shadow DOM の中です。',
    shadowBtn: 'Shadow内のボタン',
    dynamicRow: '動的な行',
    linkText: 'Floating UI のサイトを開く',
    apitargetVariantTitle: 'API から更新された説明',
    apitargetVariantText: 'update(config) によって、解説モードON中でも設定を差し替えて再構築できます。',
    freeVariantTitle: '更新後の画面説明',
    freeVariantText: 'この自由配置マーカーも update(config) の差し替え後に再生成されています。',
  },
};

let lang = getLang();
const t = (key) => ui[lang][key];

// --- Prepare a data-help-id element inside Shadow DOM (help mode detects this too) ---
const shadowHost = document.getElementById('shadow-host');
const shadow = shadowHost.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .box { margin-top: 12px; padding: 12px; border: 1px dashed #94a3b8; border-radius: 6px; }
    button { padding: 6px 14px; }
  </style>
  <div class="box">
    <p></p>
    <button type="button" data-help-id="shadowbtn"></button>
  </div>
`;
const shadowText = shadow.querySelector('p');
const shadowBtn = shadow.querySelector('button');

// --- Add/remove dynamic elements (SPA-style) ---
const list = document.getElementById('demo-dynamic-list');
let counter = 0;
document.getElementById('demo-add').addEventListener('click', () => {
  counter += 1;
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'demo-btn';
  btn.setAttribute('data-help-id', 'dynamic');
  btn.dataset.rowIndex = String(counter);
  btn.textContent = `${t('dynamicRow')} ${counter}`;
  li.appendChild(btn);
  list.appendChild(li);
});
document.getElementById('demo-remove').addEventListener('click', () => {
  if (list.lastElementChild) {
    list.removeChild(list.lastElementChild);
  }
});

// --- Open/close the modal (host app UI; operated while help mode is OFF) ---
// Keep it out of the DOM while closed, so a hidden element gets no stray markers.
const modal = document.getElementById('demo-modal');
// Grab the inner close button before detaching (getElementById can't find it once removed).
const closeModalBtn = modal.querySelector('#demo-close-modal');
modal.remove();
document.getElementById('demo-open-modal').addEventListener('click', () => {
  document.body.appendChild(modal);
  modal.hidden = false;
});
closeModalBtn.addEventListener('click', () => {
  modal.hidden = true;
  modal.remove();
});

// --- Reliability check: show that host-side events don't fire while help mode is ON ---
let clickCount = 0;
let keyCount = 0;
const clickCountEl = document.getElementById('demo-click-count');
const keyCountEl = document.getElementById('demo-key-count');

document.getElementById('demo-host-click').addEventListener('click', () => {
  clickCount += 1;
  clickCountEl.textContent = String(clickCount);
});
document.getElementById('demo-host-key').addEventListener('keydown', () => {
  keyCount += 1;
  keyCountEl.textContent = String(keyCount);
});

// --- Make the public API / callbacks visible ---
const logList = document.getElementById('demo-callback-log');
const log = (message) => {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  logList.prepend(li);
  while (logList.children.length > 8) {
    logList.lastElementChild.remove();
  }
};

let configVariant = false;
function currentHelpConfig() {
  const base = buildHelpConfig(lang);
  if (!configVariant) {
    return base;
  }
  return {
    ...base,
    apitarget: {
      title: t('apitargetVariantTitle'),
      text: t('apitargetVariantText'),
    },
    __free_001: {
      title: t('freeVariantTitle'),
      text: t('freeVariantText'),
      position: { top: 80, left: 560 },
    },
  };
}

// --- Initialize help mode ---
// The callbacks update the toggle's state label (an example of the public onEnable/onDisable).
const toggleBtn = document.getElementById('help-layer-toggle');
const inlineBtn = document.getElementById('demo-inline-btn');
const help = initHelpLayer({
  config: currentHelpConfig(),
  toggle: toggleBtn,
  markerLabel: 'i',
  // render is the escape hatch to draw the body area with your own DOM.
  // Returning nothing falls back to the default text rendering (the title is always record.title).
  render: (record) => {
    if (record.key !== 'richlink') {
      return null;
    }
    const link = document.createElement('a');
    link.href = 'https://floating-ui.com/';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = t('linkText');
    return link;
  },
  onEnable: () => {
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtn.textContent = t('toggleOn');
    log('onEnable');
  },
  onDisable: () => {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.textContent = t('toggle');
    log('onDisable');
  },
  onOpen: (record) => {
    log(`onOpen: ${record.key ?? 'inline'}`);
  },
  onClose: () => {
    log('onClose');
  },
});

document.getElementById('demo-api-open').addEventListener('click', () => {
  help.open('apitarget');
});
document.getElementById('demo-api-close').addEventListener('click', () => {
  help.close();
});
document.getElementById('demo-api-update').addEventListener('click', () => {
  configVariant = !configVariant;
  help.update(currentHelpConfig());
  log(`update(config): ${configVariant ? 'variant' : 'base'}`);
});
document.getElementById('demo-api-sequence').addEventListener('click', () => {
  help.open('apitarget');
  log('API sequence: open("apitarget")');
  setTimeout(() => {
    help.close();
    log('API sequence: close()');
  }, 900);
  setTimeout(() => {
    configVariant = !configVariant;
    help.update(currentHelpConfig());
    log(`API sequence: update(config) -> ${configVariant ? 'variant' : 'base'}`);
  }, 1400);
  setTimeout(() => {
    help.open('apitarget');
    log('API sequence: reopen after update');
  }, 1900);
});

// --- Apply the current language to all demo text, then rebuild the help config in that language ---
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('docTitle');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = ui[lang][el.dataset.i18n];
    if (value != null) {
      el.textContent = value;
    }
  });

  // Inputs (value attribute), inline help attributes, and Shadow DOM text aren't data-i18n.
  document.getElementById('username-input').value = t('usernameValue');
  document.getElementById('modal-field').value = t('modalValue');
  inlineBtn.setAttribute('data-help-title', t('inlineTitle'));
  inlineBtn.setAttribute('data-help-text', t('inlineText'));
  shadowText.textContent = t('shadowP');
  shadowBtn.textContent = t('shadowBtn');

  // Re-label any dynamic rows already on the page.
  list.querySelectorAll('button[data-help-id="dynamic"]').forEach((btn) => {
    btn.textContent = `${t('dynamicRow')} ${btn.dataset.rowIndex}`;
  });

  // Toggle label depends on the current ON/OFF state.
  toggleBtn.textContent = help.isActive() ? t('toggleOn') : t('toggle');

  // Rebuild the config in the new language (a no-op rebuild when OFF; live rebuild when ON).
  help.update(currentHelpConfig());
}

// Mount the language switcher into the nav and re-apply everything on change.
const langSlot = document.getElementById('demo-lang-slot');
const switcher = createLangSwitcher(lang, (nextLang) => {
  if (nextLang === lang) {
    return;
  }
  lang = nextLang;
  setLang(lang);
  applyLang();
  syncLangSwitcher(switcher, lang);
});
langSlot.appendChild(switcher);

applyLang();
