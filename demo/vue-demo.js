import { computed, createApp, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue/dist/vue.esm-bundler.js';

import { initHelpLayer } from '../src/index.js';
import { getLang, setLang, SUPPORTED_LANGS } from './i18n.js';

const LANG_LABELS = { en: 'EN', ja: '日本語' };

const HELP = {
  en: {
    vueName: {
      title: 'Vue: Name',
      text: 'A description attached via a normal DOM attribute to an input rendered by Vue.',
    },
    vueSaveBase: {
      title: 'Vue: Save',
      text: 'The toggle element obtained with a template ref is passed to initHelpLayer.',
    },
    vueSaveVariant: {
      title: 'Vue: Save (updated)',
      text: 'A reactive config change is watched, and controller.update(config) swaps the description.',
    },
    vueDynamic: {
      title: 'Vue: Dynamic row',
      text: 'Markers follow elements that grow/shrink in a Vue reactive list too, via MutationObserver.',
    },
    vueState: {
      title: 'Vue: API target',
      text: 'open("vueState") opens the popup from the Vue side.',
    },
  },
  ja: {
    vueName: {
      title: 'Vue: 名前',
      text: 'Vue が描画した input に、通常の DOM 属性で説明を付けています。',
    },
    vueSaveBase: {
      title: 'Vue: 保存',
      text: 'template ref で取得した toggle 要素を initHelpLayer に渡しています。',
    },
    vueSaveVariant: {
      title: 'Vue: 保存（更新後）',
      text: 'reactive な設定変更を watch し、controller.update(config) で説明を差し替えています。',
    },
    vueDynamic: {
      title: 'Vue: 動的行',
      text: 'Vue の reactive list で増減する要素にも、MutationObserver によりマーカーが追従します。',
    },
    vueState: {
      title: 'Vue: API 対象',
      text: 'open("vueState") で Vue 側からポップアップを開けます。',
    },
  },
};

const UI = {
  en: {
    nav: 'Switch demo',
    heading: 'Vue integration',
    lead: 'A minimal integration pattern: template ref / onMounted / onBeforeUnmount / watch update(config).',
    toggle: 'Help mode',
    formTitle: 'Form rendered by Vue',
    nameLabel: 'Name',
    nameValue: 'Jane Doe',
    save: 'Save',
    apiTarget: 'API target',
    dynamicTitle: 'Dynamic DOM via a reactive list',
    addRow: 'Add row',
    removeRow: 'Remove row',
    dynamicRow: 'Vue dynamic row',
    apiTitle: 'API and lifecycle',
    unmount: 'unmount',
    remount: 'remount',
    unmountedNote: 'The component-like demo was unmounted, so destroy() ran and HelpLayer’s DOM and listeners were torn down.',
  },
  ja: {
    nav: 'デモ切り替え',
    heading: 'Vue integration',
    lead: 'template ref / onMounted / onBeforeUnmount / watch update(config) の最小導入パターンです。',
    toggle: '解説モード',
    formTitle: 'Vue が描画するフォーム',
    nameLabel: '名前',
    nameValue: '山田太郎',
    save: '保存',
    apiTarget: 'API 対象',
    dynamicTitle: 'reactive list による動的 DOM',
    addRow: '行を追加',
    removeRow: '行を削除',
    dynamicRow: 'Vue 動的行',
    apiTitle: 'API とライフサイクル',
    unmount: 'unmount',
    remount: 'remount',
    unmountedNote: 'コンポーネント相当の demo を unmount したため destroy() が実行され、HelpLayer の DOM とリスナーは破棄されています。',
  },
};

function buildConfig(variant, lang) {
  const h = HELP[lang] ?? HELP.en;
  return {
    vueName: h.vueName,
    vueSave: variant ? h.vueSaveVariant : h.vueSaveBase,
    vueDynamic: h.vueDynamic,
    vueState: h.vueState,
  };
}

createApp({
  setup() {
    const mounted = ref(true);
    const toggleEl = ref(null);
    const help = ref(null);
    const rows = ref([1]);
    const variant = ref(false);
    const events = ref([]);
    const lang = ref(getLang());
    const t = computed(() => UI[lang.value] ?? UI.en);
    const config = computed(() => buildConfig(variant.value, lang.value));

    const appendEvent = (message) => {
      events.value = [
        `${new Date().toLocaleTimeString()} ${message}`,
        ...events.value.slice(0, 5),
      ];
    };

    const mountHelp = () => {
      if (!toggleEl.value || help.value) {
        return;
      }
      document.body.dataset.demoTheme = 'vue';
      help.value = initHelpLayer({
        config: config.value,
        toggle: toggleEl.value,
        markerLabel: 'V',
        onEnable: () => {
          toggleEl.value?.setAttribute('aria-pressed', 'true');
          appendEvent('onEnable');
        },
        onDisable: () => {
          toggleEl.value?.setAttribute('aria-pressed', 'false');
          appendEvent('onDisable');
        },
        onOpen: (record) => appendEvent(`onOpen: ${record.key}`),
        onClose: () => appendEvent('onClose'),
      });
    };

    const destroyHelp = () => {
      help.value?.destroy();
      help.value = null;
      delete document.body.dataset.demoTheme;
    };

    onMounted(mountHelp);
    onBeforeUnmount(destroyHelp);

    watch(config, (nextConfig) => {
      help.value?.update(nextConfig);
      appendEvent(`update(config): ${variant.value ? 'variant' : 'base'}`);
    });

    watch(lang, (next) => {
      document.documentElement.lang = next;
    }, { immediate: true });

    const changeLang = (code) => {
      setLang(code);
      lang.value = code;
    };

    const addRow = () => {
      rows.value = [...rows.value, rows.value.length + 1];
    };
    const removeRow = () => {
      rows.value = rows.value.slice(0, -1);
    };
    const unmountDemo = () => {
      destroyHelp();
      mounted.value = false;
    };
    const remountDemo = () => {
      mounted.value = true;
      nextTick(mountHelp);
    };

    return {
      addRow,
      changeLang,
      config,
      events,
      help,
      lang,
      langLabels: LANG_LABELS,
      langs: SUPPORTED_LANGS,
      mounted,
      remountDemo,
      removeRow,
      rows,
      t,
      toggleEl,
      unmountDemo,
      variant,
    };
  },
  template: `
    <div class="framework-shell">
      <nav class="framework-nav" :aria-label="t.nav">
        <a href="/demo/">Vanilla</a>
        <a href="/demo/react.html">React</a>
        <a href="/demo/vue.html" aria-current="page">Vue</a>
        <div class="demo-lang" role="group" aria-label="Language">
          <button v-for="code in langs" :key="code" type="button" class="demo-lang__btn"
            :aria-pressed="String(code === lang)" @click="changeLang(code)">{{ langLabels[code] }}</button>
        </div>
      </nav>

      <section v-if="!mounted" class="framework-card">
        <h1>{{ t.heading }}</h1>
        <p>{{ t.unmountedNote }}</p>
        <button class="framework-btn framework-btn--primary" type="button" @click="remountDemo">{{ t.remount }}</button>
      </section>

      <template v-else>
        <header class="framework-header">
          <div>
            <h1>{{ t.heading }}</h1>
            <p>{{ t.lead }}</p>
          </div>
          <button ref="toggleEl" class="framework-toggle" type="button" aria-pressed="false">{{ t.toggle }}</button>
        </header>

        <section class="framework-card">
          <h2>{{ t.formTitle }}</h2>
          <div class="framework-field">
            <label for="vue-name">{{ t.nameLabel }}</label>
            <input id="vue-name" class="framework-input" data-help-id="vueName" :value="t.nameValue">
          </div>
          <button class="framework-btn framework-btn--primary" type="button" data-help-id="vueSave">{{ t.save }}</button>
          <button class="framework-btn" type="button" data-help-id="vueState">{{ t.apiTarget }}</button>
        </section>

        <section class="framework-card">
          <h2>{{ t.dynamicTitle }}</h2>
          <button class="framework-btn" type="button" @click="addRow">{{ t.addRow }}</button>
          <button class="framework-btn" type="button" @click="removeRow">{{ t.removeRow }}</button>
          <ul class="framework-list">
            <li v-for="row in rows" :key="row">
              <button class="framework-btn" type="button" data-help-id="vueDynamic">{{ t.dynamicRow }} {{ row }}</button>
            </li>
          </ul>
        </section>

        <section class="framework-card">
          <h2>{{ t.apiTitle }}</h2>
          <button class="framework-btn" type="button" @click="help?.open('vueState')">open("vueState")</button>
          <button class="framework-btn" type="button" @click="help?.close()">close()</button>
          <button class="framework-btn" type="button" @click="variant = !variant">update(config)</button>
          <button class="framework-btn" type="button" @click="unmountDemo">{{ t.unmount }}</button>
          <div class="framework-log" aria-live="polite">
            <p v-for="event in events" :key="event">{{ event }}</p>
          </div>
        </section>
      </template>
    </div>
  `,
}).mount('#vue-root');
