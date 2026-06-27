import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { initHelpLayer } from '../src/index.js';
import { getLang, setLang, SUPPORTED_LANGS } from './i18n.js';
import { mountShowcase } from './showcase.js';
import { showcaseStrings } from './showcase-i18n.js';
import { injectCodeStyleOnce, copyText } from './code-snippet.js';
import { mountSiteChrome } from './site-chrome.js';

// Concise, accurate React-idiom snippets per card (values illustrative; only labels are i18n'd).
const SNIPPETS = {
  form: `const toggleRef = useRef(null);
const help = useRef(null);

useEffect(() => {
  help.current = initHelpLayer({
    toggle: toggleRef.current,
    config: { reactSave: { title: 'Save', text: 'Saves your input.' } },
  });
  return () => help.current?.destroy();
}, []);

<button ref={toggleRef}>Help mode</button>
<button data-help-id="reactSave">Save</button>`,
  dynamic: `// Markers follow state-driven lists via MutationObserver — no extra wiring.
{rows.map((r) => (
  <button key={r} data-help-id="reactDynamic">Row {r}</button>
))}`,
  api: `help.current?.open('reactState');  // open programmatically
help.current?.close();

// Swap content on state change:
useEffect(() => { help.current?.update(config); }, [config]);

// Unmounting the component runs cleanup -> destroy() (full teardown).`,
};

function CodeBlock({ code, lang }) {
  const sc = showcaseStrings(lang);
  const [copyLabel, setCopyLabel] = useState(sc.copy);
  const resetTimer = useRef(0);
  useEffect(() => {
    injectCodeStyleOnce();
    return () => clearTimeout(resetTimer.current);
  }, []);
  useEffect(() => {
    setCopyLabel(showcaseStrings(lang).copy);
  }, [lang]);
  const onCopy = async() => {
    const ok = await copyText(code);
    setCopyLabel(ok ? showcaseStrings(lang).copied : showcaseStrings(lang).copy);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyLabel(showcaseStrings(lang).copy), 1200);
  };
  return (
    <details className="demo-code">
      <summary>{sc.showCode}</summary>
      <div className="demo-code__body">
        <button type="button" className="demo-code__copy" onClick={onCopy}>{copyLabel}</button>
        <pre><code>{code}</code></pre>
      </div>
    </details>
  );
}

const LANG_LABELS = { en: 'EN', ja: '日本語' };

// Help content (titles/bodies) per language. reactSave has a "variant" used to demo update(config).
const HELP = {
  en: {
    reactName: {
      title: 'React: Name',
      text: 'A description attached via a normal DOM attribute to an input rendered by a React component.',
    },
    reactSaveBase: {
      title: 'React: Save',
      text: 'The toggle element obtained with useRef is passed to initHelpLayer.',
    },
    reactSaveVariant: {
      title: 'React: Save (updated)',
      text: 'After a state change, controller.update(config) is called to swap the description.',
    },
    reactDynamic: {
      title: 'React: Dynamic row',
      text: 'Markers follow elements that grow/shrink with React state too, via MutationObserver.',
    },
    reactState: {
      title: 'React: API target',
      text: 'open("reactState") opens the popup from the React side.',
    },
  },
  ja: {
    reactName: {
      title: 'React: 名前',
      text: 'React コンポーネントが描画した input に、通常の DOM 属性で説明を付けています。',
    },
    reactSaveBase: {
      title: 'React: 保存',
      text: 'useRef で取得した toggle 要素を initHelpLayer に渡しています。',
    },
    reactSaveVariant: {
      title: 'React: 保存（更新後）',
      text: 'state 変更後に controller.update(config) を呼び、説明文を差し替えています。',
    },
    reactDynamic: {
      title: 'React: 動的行',
      text: 'React state で増減する要素にも、MutationObserver によりマーカーが追従します。',
    },
    reactState: {
      title: 'React: API 対象',
      text: 'open("reactState") で React 側からポップアップを開けます。',
    },
  },
};

// UI strings for the page chrome.
const UI = {
  en: {
    nav: 'Switch demo',
    heading: 'React integration',
    lead: 'A minimal integration pattern: useRef / useEffect / cleanup destroy() / update(config).',
    toggle: 'Help mode',
    formTitle: 'Explain fields in a React form',
    nameLabel: 'Name',
    save: 'Save',
    apiTarget: 'API target',
    dynamicTitle: 'Follows React state changes',
    addRow: 'Add row',
    removeRow: 'Remove row',
    dynamicRow: 'React dynamic row',
    apiTitle: 'Control & clean up via the API',
    unmount: 'unmount',
    remount: 'remount',
    unmountedNote: 'The component was unmounted, so destroy() ran and HelpLayer’s DOM and listeners were torn down.',
    nameValue: 'Jane Doe',
  },
  ja: {
    nav: 'デモ切り替え',
    heading: 'React integration',
    lead: 'useRef / useEffect / cleanup destroy() / update(config) の最小導入パターンです。',
    toggle: '解説モード',
    formTitle: 'React フォームの項目を説明',
    nameLabel: '名前',
    save: '保存',
    apiTarget: 'API 対象',
    dynamicTitle: 'React state の変化に追従',
    addRow: '行を追加',
    removeRow: '行を削除',
    dynamicRow: 'React 動的行',
    apiTitle: 'API で制御・後始末',
    unmount: 'unmount',
    remount: 'remount',
    unmountedNote: 'コンポーネントを unmount したため destroy() が実行され、HelpLayer の DOM とリスナーは破棄されています。',
    nameValue: '山田太郎',
  },
};

function buildConfig(variant, lang) {
  const h = HELP[lang] ?? HELP.en;
  return {
    reactName: h.reactName,
    reactSave: variant ? h.reactSaveVariant : h.reactSaveBase,
    reactDynamic: h.reactDynamic,
    reactState: h.reactState,
  };
}

function LangSwitcher({ lang, onChange }) {
  return (
    <div className="demo-lang" role="group" aria-label="Language">
      {SUPPORTED_LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className="demo-lang__btn"
          aria-pressed={code === lang}
          onClick={() => onChange(code)}>
          {LANG_LABELS[code]}
        </button>
      ))}
    </div>
  );
}

function ReactIntegrationDemo({ lang, onChangeLang, onUnmountDemo }) {
  const toggleRef = useRef(null);
  const helpRef = useRef(null);
  const showcaseRef = useRef(null);
  const aliveRef = useRef(true);
  const eventIdRef = useRef(0);
  const [rows, setRows] = useState([1]);
  const [variant, setVariant] = useState(false);
  const [events, setEvents] = useState([]);
  const t = UI[lang] ?? UI.en;
  const sc = showcaseStrings(lang);
  const config = useMemo(() => buildConfig(variant, lang), [variant, lang]);

  const appendEvent = (message) => {
    if (!aliveRef.current) {
      return;
    }
    // Use a monotonic id as the React key — two identical messages can land in the same second, so the
    // "timestamp + text" string isn't unique enough and would trigger a duplicate-key warning.
    eventIdRef.current += 1;
    const entry = { id: eventIdRef.current, text: `${new Date().toLocaleTimeString()} ${message}` };
    setEvents((current) => [entry, ...current.slice(0, 5)]);
  };

  useEffect(() => {
    aliveRef.current = true;
    document.body.dataset.demoTheme = 'react';
    helpRef.current = initHelpLayer({
      config,
      toggle: toggleRef.current,
      markerLabel: 'R',
      onEnable: () => {
        toggleRef.current?.setAttribute('aria-pressed', 'true');
        showcaseRef.current?.handleEnable();
        appendEvent('onEnable');
      },
      onDisable: () => {
        toggleRef.current?.setAttribute('aria-pressed', 'false');
        showcaseRef.current?.handleDisable();
        appendEvent('onDisable');
      },
      onOpen: (record) => {
        showcaseRef.current?.handleOpen();
        appendEvent(`onOpen: ${record.key}`);
      },
      onClose: () => appendEvent('onClose'),
    });
    // Demo-only value layer (first-run coach + status pill). Overlay chrome; library untouched.
    showcaseRef.current = mountShowcase({ toggleEl: toggleRef.current, lang });

    return () => {
      aliveRef.current = false;
      helpRef.current?.destroy();
      helpRef.current = null;
      showcaseRef.current?.destroy();
      showcaseRef.current = null;
      delete document.body.dataset.demoTheme;
    };
  }, []);

  useEffect(() => {
    showcaseRef.current?.setLang(lang);
  }, [lang]);

  useEffect(() => {
    helpRef.current?.update(config);
    appendEvent(`update(config): ${variant ? 'variant' : 'base'}`);
  }, [config]);

  return (
    <div className="framework-shell">
      <nav className="framework-nav" aria-label={t.nav}>
        <a href="./">Vanilla</a>
        <a href="./react.html" aria-current="page">React</a>
        <a href="./vue.html">Vue</a>
        <a href="./stress.html">Stress</a>
        <LangSwitcher lang={lang} onChange={onChangeLang} />
      </nav>

      <header className="framework-header">
        <div>
          <h1>{t.heading}</h1>
          <p>{t.lead}</p>
          <p className="framework-tagline">{sc.heroTagline}</p>
        </div>
        <button ref={toggleRef} className="framework-toggle" type="button" aria-pressed="false">
          {t.toggle}
        </button>
      </header>

      <section className="framework-card">
        <h2>{t.formTitle}</h2>
        <div className="framework-field">
          <label htmlFor="react-name">{t.nameLabel}</label>
          <input key={`name-${lang}`} id="react-name" className="framework-input" data-help-id="reactName" defaultValue={t.nameValue} />
        </div>
        <button className="framework-btn framework-btn--primary" type="button" data-help-id="reactSave">
          {t.save}
        </button>
        <button className="framework-btn" type="button" data-help-id="reactState">
          {t.apiTarget}
        </button>
        <CodeBlock code={SNIPPETS.form} lang={lang} />
      </section>

      <section className="framework-card">
        <h2>{t.dynamicTitle}</h2>
        <button className="framework-btn" type="button" onClick={() => setRows((current) => [...current, current.length + 1])}>
          {t.addRow}
        </button>
        <button className="framework-btn" type="button" onClick={() => setRows((current) => current.slice(0, -1))}>
          {t.removeRow}
        </button>
        <ul className="framework-list">
          {rows.map((row) => (
            <li key={row}>
              <button className="framework-btn" type="button" data-help-id="reactDynamic">
                {t.dynamicRow} {row}
              </button>
            </li>
          ))}
        </ul>
        <CodeBlock code={SNIPPETS.dynamic} lang={lang} />
      </section>

      <section className="framework-card">
        <h2>{t.apiTitle}</h2>
        <button className="framework-btn" type="button" onClick={() => helpRef.current?.open('reactState')}>
          open("reactState")
        </button>
        <button className="framework-btn" type="button" onClick={() => helpRef.current?.close()}>
          close()
        </button>
        <button className="framework-btn" type="button" onClick={() => setVariant((value) => !value)}>
          update(config)
        </button>
        <button className="framework-btn" type="button" onClick={onUnmountDemo}>
          {t.unmount}
        </button>
        <div className="framework-log" aria-live="polite">
          {events.map((event) => (
            <p key={event.id}>{event.text}</p>
          ))}
        </div>
        <CodeBlock code={SNIPPETS.api} lang={lang} />
      </section>
    </div>
  );
}

function App() {
  const [mounted, setMounted] = useState(true);
  const [lang, setLangState] = useState(getLang());
  const t = UI[lang] ?? UI.en;
  const chromeRef = useRef(null);

  // Shared footer (adoption path). Mounted once for the page; persists across demo unmount/remount.
  useEffect(() => {
    chromeRef.current = mountSiteChrome(lang);
  }, []);
  useEffect(() => {
    chromeRef.current?.setLang(lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const changeLang = (code) => {
    setLang(code);
    setLangState(code);
  };

  if (!mounted) {
    return (
      <div className="framework-shell">
        <nav className="framework-nav" aria-label={t.nav}>
          <a href="./">Vanilla</a>
          <a href="./react.html" aria-current="page">React</a>
          <a href="./vue.html">Vue</a>
          <a href="./stress.html">Stress</a>
          <LangSwitcher lang={lang} onChange={changeLang} />
        </nav>
        <section className="framework-card">
          <h1>{t.heading}</h1>
          <p>{t.unmountedNote}</p>
          <button className="framework-btn framework-btn--primary" type="button" onClick={() => setMounted(true)}>
            {t.remount}
          </button>
        </section>
      </div>
    );
  }

  return <ReactIntegrationDemo lang={lang} onChangeLang={changeLang} onUnmountDemo={() => setMounted(false)} />;
}

createRoot(document.getElementById('react-root')).render(<App />);
