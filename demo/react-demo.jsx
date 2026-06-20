import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { initHelpLayer } from '../src/index.js';
import { getLang, setLang, SUPPORTED_LANGS } from './i18n.js';

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
    formTitle: 'Form rendered by React',
    nameLabel: 'Name',
    save: 'Save',
    apiTarget: 'API target',
    dynamicTitle: 'Dynamic DOM via state',
    addRow: 'Add row',
    removeRow: 'Remove row',
    dynamicRow: 'React dynamic row',
    apiTitle: 'API and lifecycle',
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
    formTitle: 'React が描画するフォーム',
    nameLabel: '名前',
    save: '保存',
    apiTarget: 'API 対象',
    dynamicTitle: 'state による動的 DOM',
    addRow: '行を追加',
    removeRow: '行を削除',
    dynamicRow: 'React 動的行',
    apiTitle: 'API とライフサイクル',
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
  const aliveRef = useRef(true);
  const [rows, setRows] = useState([1]);
  const [variant, setVariant] = useState(false);
  const [events, setEvents] = useState([]);
  const t = UI[lang] ?? UI.en;
  const config = useMemo(() => buildConfig(variant, lang), [variant, lang]);

  const appendEvent = (message) => {
    if (!aliveRef.current) {
      return;
    }
    setEvents((current) => [
      `${new Date().toLocaleTimeString()} ${message}`,
      ...current.slice(0, 5),
    ]);
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
        appendEvent('onEnable');
      },
      onDisable: () => {
        toggleRef.current?.setAttribute('aria-pressed', 'false');
        appendEvent('onDisable');
      },
      onOpen: (record) => appendEvent(`onOpen: ${record.key}`),
      onClose: () => appendEvent('onClose'),
    });

    return () => {
      aliveRef.current = false;
      helpRef.current?.destroy();
      helpRef.current = null;
      delete document.body.dataset.demoTheme;
    };
  }, []);

  useEffect(() => {
    helpRef.current?.update(config);
    appendEvent(`update(config): ${variant ? 'variant' : 'base'}`);
  }, [config]);

  return (
    <div className="framework-shell">
      <nav className="framework-nav" aria-label={t.nav}>
        <a href="/demo/">Vanilla</a>
        <a href="/demo/react.html" aria-current="page">React</a>
        <a href="/demo/vue.html">Vue</a>
        <LangSwitcher lang={lang} onChange={onChangeLang} />
      </nav>

      <header className="framework-header">
        <div>
          <h1>{t.heading}</h1>
          <p>{t.lead}</p>
        </div>
        <button ref={toggleRef} className="framework-toggle" type="button" aria-pressed="false">
          {t.toggle}
        </button>
      </header>

      <section className="framework-card">
        <h2>{t.formTitle}</h2>
        <div className="framework-field">
          <label htmlFor="react-name">{t.nameLabel}</label>
          <input id="react-name" className="framework-input" data-help-id="reactName" defaultValue={t.nameValue} />
        </div>
        <button className="framework-btn framework-btn--primary" type="button" data-help-id="reactSave">
          {t.save}
        </button>
        <button className="framework-btn" type="button" data-help-id="reactState">
          {t.apiTarget}
        </button>
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
            <p key={event}>{event}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [mounted, setMounted] = useState(true);
  const [lang, setLangState] = useState(getLang());
  const t = UI[lang] ?? UI.en;

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
          <a href="/demo/">Vanilla</a>
          <a href="/demo/react.html" aria-current="page">React</a>
          <a href="/demo/vue.html">Vue</a>
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
