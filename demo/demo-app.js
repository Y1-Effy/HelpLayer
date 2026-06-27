import { initHelpLayer } from '../src/index.js';

import { buildHelpConfig } from './helpConfig.js';
import { createLangSwitcher, getLang, setLang, syncLangSwitcher } from './i18n.js';
import { mountShowcase } from './showcase.js';
import { showcaseStrings } from './showcase-i18n.js';
import { createCodeBlock, copyText } from './code-snippet.js';
import { mountSiteChrome } from './site-chrome.js';

// UI strings for the demo page (English / Japanese). Keys used as text content are matched by the
// `data-i18n` attribute in index.html; the rest are applied imperatively in applyLang().
const ui = {
  en: {
    docTitle: 'HelpLayer Demo',
    appTitle: 'Admin screen sample',
    formTitle: 'Explain form fields in place',
    usernameLabel: 'Username',
    usernameValue: 'Jane Doe',
    saveBtn: 'Save',
    scrollTitle: 'Markers follow inside scroll areas',
    scrollTop: 'Dummy content at the top. Scroll down and the button appears.',
    scrollBtn: 'Button inside the scroll',
    scrollBottom: 'Dummy content at the bottom.',
    dynamicTitle: 'Works with dynamic SPA elements',
    dynamicDesc: 'Markers follow even when rows are added/removed while help mode is ON.',
    addRow: 'Add row',
    removeRow: 'Remove row',
    modalShadowTitle: 'Reaches modals & Shadow DOM',
    openModal: 'Open modal',
    inlineRichTitle: 'Author help inline or with rich content',
    inlineRichDesc: 'The left button has no config entry — its description comes from data attributes only. The middle shows line breaks in the body; the right uses custom rendering via render.',
    inlineBtn: 'Inline definition',
    inlineTitle: 'Inline definition',
    inlineText: 'This description is written directly in the data-help-title / data-help-text attributes. No config object needed.',
    multilineBtn: 'Multi-line description',
    richlinkBtn: 'render (link)',
    blockingTitle: 'Focus on reading — no accidental clicks',
    blockingDesc: "With help mode OFF the counter increments. While ON you can verify that interactions don't reach the host app.",
    hostClickBtn: 'Host-side click',
    keyLabel: 'Key input',
    apiTitle: 'Drive it from your app via the API',
    customizeTitle: 'Make it match your UI',
    customizeDesc: 'Tune behavior with options, and restyle entirely with CSS custom properties (dark mode is built in). Nothing here requires changing your app code.',
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
    linkText: 'Open the HelpLayer docs',
    apitargetVariantTitle: 'Description updated from the API',
    apitargetVariantText: 'With update(config) you can swap the config and rebuild even while help mode is ON.',
    freeVariantTitle: 'Updated screen description',
    freeVariantText: 'This free-placement marker is also regenerated after update(config).',
    diagnosticsTitle: 'Check your config against the live DOM',
    diagnosticsDesc: "diagnose() scans the page right now and reports how each config key maps onto it — including dynamic and Shadow DOM elements a static scan can't see.",
    diagnoseBtn: 'Run diagnose()',
    diagCaption: "diagnose() result (also printed to the console). With debug:true it's callable as window.helpLayerDiagnose().",
    diagCategory: 'Category',
    diagCount: 'Count',
    diagBound: 'bound (config → element)',
    diagInline: 'inline (data attrs only)',
    diagUnmatched: 'unmatchedConfig (no element now)',
    diagFree: 'free (placement coords)',
    diagMissing: 'missingConfig (error)',
    cliNote: 'For CI, the help-layer check CLI runs the same audit statically from your source files, and scaffold generates a config stub from your markup.',
    markerPlacementLabel: 'Marker placement',
    popupPlacementLabel: 'Popup placement',
    placementHint: 'Pick a placement, then turn Help mode ON to see where markers and popups anchor. (Host controls are inert while Help mode is ON, so change them first.)',
  },
  ja: {
    docTitle: 'HelpLayer デモ',
    appTitle: '管理画面サンプル',
    formTitle: 'フォーム項目をその場で説明',
    usernameLabel: 'ユーザー名',
    usernameValue: '山田太郎',
    saveBtn: '保存',
    scrollTitle: 'スクロール内でも説明が追従',
    scrollTop: '上部のダミー内容です。下にスクロールするとボタンが現れます。',
    scrollBtn: 'スクロール内のボタン',
    scrollBottom: '下部のダミー内容です。',
    dynamicTitle: '動的に増減する要素にも対応',
    dynamicDesc: '解説モードON中に追加/削除してもマーカーが追従します。',
    addRow: '行を追加',
    removeRow: '行を削除',
    modalShadowTitle: 'モーダルや Shadow DOM の中まで',
    openModal: 'モーダルを開く',
    inlineRichTitle: '説明はインラインでもリッチ本文でも',
    inlineRichDesc: '左のボタンは config に書かず data 属性だけで説明を付けています。中央は本文の改行、右は render での自前描画です。',
    inlineBtn: 'インライン定義',
    inlineTitle: 'インライン定義',
    inlineText: 'この説明は data-help-title / data-help-text 属性に直接書いています。config オブジェクト不要です。',
    multilineBtn: '複数行の説明',
    richlinkBtn: 'render（リンク）',
    blockingTitle: '誤操作なしで説明に集中',
    blockingDesc: '解説モードOFFではカウンターが増えます。ON中はホストアプリ側の操作へ届かないことを確認できます。',
    hostClickBtn: 'ホスト側クリック',
    keyLabel: 'キー入力',
    apiTitle: 'アプリから API で制御',
    customizeTitle: 'あなたの UI に合わせる',
    customizeDesc: 'オプションで挙動を調整し、CSS カスタムプロパティで見た目を全面的に変更できます（ダークモード内蔵）。アプリ側のコード変更は不要です。',
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
    linkText: 'HelpLayer のドキュメントを開く',
    apitargetVariantTitle: 'API から更新された説明',
    apitargetVariantText: 'update(config) によって、解説モードON中でも設定を差し替えて再構築できます。',
    freeVariantTitle: '更新後の画面説明',
    freeVariantText: 'この自由配置マーカーも update(config) の差し替え後に再生成されています。',
    diagnosticsTitle: 'config と実 DOM の対応を確認',
    diagnosticsDesc: 'diagnose() は今この瞬間のページを走査し、各 config キーがどの要素に対応しているかを報告します。静的走査では見えない動的要素や Shadow DOM も含みます。',
    diagnoseBtn: 'diagnose() を実行',
    diagCaption: 'diagnose() の結果（コンソールにも出力）。debug:true なら window.helpLayerDiagnose() でも呼べます。',
    diagCategory: '分類',
    diagCount: '件数',
    diagBound: 'bound（config→要素）',
    diagInline: 'inline（data属性のみ）',
    diagUnmatched: 'unmatchedConfig（今は要素なし）',
    diagFree: 'free（座標配置）',
    diagMissing: 'missingConfig（エラー）',
    cliNote: 'CI 向けには help-layer check CLI が同じ監査をソースから静的に実行し、scaffold がマークアップから config 雛形を生成します。',
    markerPlacementLabel: 'マーカー配置',
    popupPlacementLabel: 'ポップアップ配置',
    placementHint: '配置を選んでから解説モードを ON にすると、マーカー/ポップアップの位置を確認できます（ON 中は host 操作が無効になるため、先に変更してください）。',
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

// Demo-only "value layer": a first-run coach (turn ON -> click an "i") and a mode/marker status pill.
// It's pure overlay chrome (pointer-events: none), so it never affects the library or the e2e suite.
const showcase = mountShowcase({ toggleEl: toggleBtn, lang });

// Shared footer: value chips, a11y note, copy-paste install, and links out (adoption path).
const siteChrome = mountSiteChrome(lang);

// Placement playground controls (in the Customize card). markerPlacement / popupPlacement are read at
// init time, so changing them rebuilds the instance below.
const markerPlacementSel = document.getElementById('demo-marker-placement');
const popupPlacementSel = document.getElementById('demo-popup-placement');

// Build the single help instance. Wrapped in a function so the placement playground can rebuild it with
// new markerPlacement / popupPlacement; the API/diagnose handlers below read `help` lazily, so they keep
// working across rebuilds.
function createHelp() {
  return initHelpLayer({
    config: currentHelpConfig(),
    toggle: toggleBtn,
    markerLabel: 'i',
    markerPlacement: markerPlacementSel.value,
    popupPlacement: popupPlacementSel.value,
    // Dev aid: exposes window.helpLayerDiagnose() so you can audit the live config mapping from the console.
    debug: true,
    // render is the escape hatch to draw the body area with your own DOM.
    // Returning nothing falls back to the default text rendering (the title is always record.title).
    render: (record) => {
      if (record.key !== 'richlink') {
        return null;
      }
      const link = document.createElement('a');
      link.href = 'https://github.com/Y1-Effy/HelpLayer#readme';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = t('linkText');
      return link;
    },
    onEnable: () => {
      toggleBtn.setAttribute('aria-pressed', 'true');
      toggleBtn.textContent = t('toggleOn');
      showcase.handleEnable();
      log('onEnable');
    },
    onDisable: () => {
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.textContent = t('toggle');
      showcase.handleDisable();
      log('onDisable');
    },
    onOpen: (record) => {
      showcase.handleOpen();
      log(`onOpen: ${record.key ?? 'inline'}`);
    },
    onClose: () => {
      log('onClose');
    },
  });
}

let help = createHelp();

// Swap markerPlacement / popupPlacement by rebuilding the instance, preserving the ON/OFF state so the
// change is visible immediately on the existing markers.
function rebuildHelpPreservingState() {
  const wasActive = help.isActive();
  help.destroy();
  help = createHelp();
  if (wasActive) {
    help.enable();
  }
}
markerPlacementSel.addEventListener('change', rebuildHelpPreservingState);
popupPlacementSel.addEventListener('change', rebuildHelpPreservingState);

// --- Runtime diagnostics: render diagnose()'s per-category summary onto the page ---
const diagnoseOut = document.getElementById('demo-diagnose-out');
let lastDiagnose = null;

// diagnose() returns the full RuntimeReport (and logs a console.table); here we surface just the
// per-category counts so the page shows the same picture. Built with textContent only (XSS-safe).
function renderDiagnose(report) {
  const { summary } = report;
  const rows = [
    ['diagBound', summary.bound],
    ['diagInline', summary.inline],
    ['diagUnmatched', summary.unmatchedConfig],
    ['diagFree', summary.free],
    ['diagMissing', summary.missingConfig],
  ];
  diagnoseOut.textContent = '';

  const caption = document.createElement('p');
  caption.className = 'demo-diagnose__caption';
  caption.textContent = t('diagCaption');

  const table = document.createElement('table');
  table.className = 'demo-diagnose__table';
  const head = document.createElement('tr');
  for (const key of ['diagCategory', 'diagCount']) {
    const th = document.createElement('th');
    th.textContent = t(key);
    head.appendChild(th);
  }
  table.appendChild(head);
  for (const [labelKey, count] of rows) {
    const tr = document.createElement('tr');
    const cat = document.createElement('td');
    cat.textContent = t(labelKey);
    const num = document.createElement('td');
    num.textContent = String(count);
    tr.append(cat, num);
    table.appendChild(tr);
  }

  diagnoseOut.append(caption, table);
}

document.getElementById('demo-diagnose').addEventListener('click', () => {
  lastDiagnose = help.diagnose();
  renderDiagnose(lastDiagnose);
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

// --- "Show the code" blocks: reveal the minimal code behind each card (with copy) ---
// Snippets are concise, accurate, language-neutral examples (only the summary/copy labels are i18n'd).
const SNIPPETS = {
  form: `<button data-help-id="save">Save</button>
<button id="help-toggle">Help mode</button>

initHelpLayer({
  toggle: '#help-toggle',
  config: {
    save: { title: 'Save', text: 'Saves your input.' },
  },
});`,
  scroll: `<div style="overflow:auto; height:160px">
  <button data-help-id="inneritem">Button</button>
</div>

// Markers follow their target inside scroll containers
// automatically — no extra code.`,
  dynamic: `// Add elements anytime while help mode is ON:
const li = document.createElement('li');
li.innerHTML = '<button data-help-id="dynamic">Row</button>';
list.appendChild(li);
// A MutationObserver mounts the marker automatically.`,
  modalShadow: `// Elements inside modals and OPEN Shadow DOM get markers too.
host.attachShadow({ mode: 'open' }).innerHTML =
  '<button data-help-id="shadowbtn">In shadow</button>';

config: { shadowbtn: { title: '...', text: '...' } }`,
  inlineRich: `<!-- No config entry needed: define help inline -->
<button data-help-title="Save"
        data-help-text="Saves your input.">Save</button>

<!-- Rich body via render() -->
initHelpLayer({
  config,
  render(record) {
    if (record.key !== 'richlink') return null;
    const a = document.createElement('a');
    a.href = '/docs'; a.textContent = 'Learn more';
    return a;
  },
});`,
  blocking: `<button data-help-id="hostevent">Host click</button>

// While help mode is ON, a transparent layer absorbs
// clicks/keys so they never reach your app. It's automatic —
// nothing to wire, and your existing listeners stay attached.`,
  api: `const help = initHelpLayer({ toggle: '#help-toggle', config });

help.open('apitarget');  // open a description programmatically
help.close();            // close it
help.update(newConfig);  // swap content (live-rebuilds if ON)
help.destroy();          // detach + full teardown`,
  // The Customize card shows two separately-copyable blocks: options (JS) and theme (CSS).
  customizeJs: `// Options
initHelpLayer({
  toggle: '#help-toggle',
  config,
  markerLabel: 'i',           // character on the marker (default '?')
  markerPlacement: 'top-end', // which corner to overlap
  popupPlacement: 'bottom-start',
  attribute: 'data-help-id',  // change the target attribute name
  silent: true,               // suppress warnings for unregistered keys
  nonce: pageNonce,           // allow the injected <style> under a strict CSP
  render(record) { /* return your own DOM for the body */ },
});`,
  // The Diagnostics card shows two separately-copyable blocks: the runtime API (JS) and the static CLI.
  diagnosticsJs: `// Runtime diagnostics: scan the live DOM and report the mapping.
const help = initHelpLayer({ toggle: '#help-toggle', config, debug: true });

const report = help.diagnose();   // also prints a console.table
console.log(report.summary);      // { bound, inline, missingConfig, ... }
// With debug:true it's also on window.helpLayerDiagnose().`,
  diagnosticsCli: `# Static audit from your source files (great for CI):
npx help-layer check --config helpConfig.js --src src

# Generate a config stub from the data-help-id's in your markup:
npx help-layer scaffold --src src --out helpConfig.js`,
  customizeCss: `/* Theme via CSS custom properties (dark mode is built in) */
:root {
  --help-layer-marker-bg: #0f6bff;
  --help-layer-marker-color: #fff;
  --help-layer-popup-bg: #fff;
  --help-layer-popup-color: #1f2933;
  --help-layer-accent: #1d4ed8;
  --help-layer-overlay-bg: rgba(0,0,0,.12); /* scrim while ON */
  --help-layer-overlay-cursor: not-allowed;
}`,
};

const codeBlocks = [];
function addCodeBlock(card, code) {
  const { details, summary, copyBtn } = createCodeBlock(code);
  copyBtn.addEventListener('click', async() => {
    const ok = await copyText(code);
    copyBtn.textContent = ok ? showcaseStrings(lang).copied : showcaseStrings(lang).copy;
    setTimeout(() => {
      copyBtn.textContent = showcaseStrings(lang).copy;
    }, 1200);
  });
  card.appendChild(details);
  codeBlocks.push({ summary, copyBtn });
}
document.querySelectorAll('[data-snippet]').forEach((card) => {
  const key = card.dataset.snippet;
  // The Customize card documents two things, shown as two separately-copyable blocks.
  if (key === 'customize') {
    addCodeBlock(card, SNIPPETS.customizeJs);
    addCodeBlock(card, SNIPPETS.customizeCss);
    return;
  }
  // The Diagnostics card pairs the runtime API with the static CLI, as two copyable blocks.
  if (key === 'diagnostics') {
    addCodeBlock(card, SNIPPETS.diagnosticsJs);
    addCodeBlock(card, SNIPPETS.diagnosticsCli);
    return;
  }
  const code = SNIPPETS[key];
  if (code) {
    addCodeBlock(card, code);
  }
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
  // The modal is detached from the DOM while closed, so reach its field via the retained `modal`
  // reference (getElementById wouldn't find it) — this works whether the modal is open or not.
  modal.querySelector('#modal-field').value = t('modalValue');
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

  // Demo hero copy + showcase chrome follow the language too.
  const sc = showcaseStrings(lang);
  document.getElementById('demo-hero-tagline').textContent = sc.heroTagline;
  document.getElementById('demo-hero-hint').textContent = sc.heroHint;
  showcase.setLang(lang);
  siteChrome.setLang(lang);

  // "Show the code" summary/copy labels follow the language too.
  codeBlocks.forEach(({ summary, copyBtn }) => {
    summary.textContent = sc.showCode;
    copyBtn.textContent = sc.copy;
  });

  // Re-render the diagnose() table (if shown) so its labels follow the language too.
  if (lastDiagnose) {
    renderDiagnose(lastDiagnose);
  }

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
