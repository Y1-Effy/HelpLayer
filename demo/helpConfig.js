/**
 * Demo help content in English and Japanese. `buildHelpConfig(lang)` returns the helpConfig for the
 * given language; the demo rebuilds it (and calls controller.update) whenever the language switches.
 */

const CONTENT = {
  en: {
    username: {
      title: 'Username',
      text: 'The name shown on the list screen. You can change it later.',
    },
    save: {
      title: 'Save',
      text: 'Saves your input. After saving, it is reflected on the list screen.',
    },
    inneritem: {
      title: 'Button inside the scroll area',
      text: 'An element inside an inner scroll container. The marker keeps following even as you scroll the container.',
    },
    fixedbar: {
      title: 'Fixed bar',
      text: 'A button on a position: fixed bar. The marker keeps following even as you scroll the page.',
    },
    modalfield: {
      title: 'Field inside the modal',
      text: 'Elements inside a modal get markers too.',
    },
    shadowbtn: {
      title: 'Button inside Shadow DOM',
      text: 'An element inside Shadow DOM. The marker follows across the shadow boundary.',
    },
    dynamic: {
      title: 'Dynamically added row',
      text: 'An element added while help mode is ON. It is detected via MutationObserver and gets a marker.',
    },
    multiline: {
      title: 'Multi-line description',
      text: 'A \\n in the body is shown as a line break.\nLine 1\nLine 2\nIt stays plain text, so there is no XSS risk.',
    },
    richlink: {
      title: 'Custom rendering via render',
      text: '(This text is shown when no render is provided.)',
    },
    hostevent: {
      title: 'Host-side event',
      text: 'While help mode is ON, clicks on this button do not reach the host app. Existing listeners stay attached; a transparent layer absorbs the interaction.',
    },
    keyevent: {
      title: 'Key-input blocking',
      text: 'While help mode is ON, key input to host-side forms is suppressed too. Escape can be used to close the popup / exit help mode.',
    },
    apitarget: {
      title: 'Target opened from the API',
      text: 'open("apitarget") opens this description programmatically. Combine it with close() and update() to drive it from your app state.',
    },
    __free_001: {
      title: 'About this screen',
      text: 'A demo screen to check anchoring, dynamic elements, Shadow DOM, modals, and a11y.',
      position: { top: 80, left: 560 },
    },
  },
  ja: {
    username: {
      title: 'ユーザー名',
      text: '一覧画面に表示される名前です。後から変更できます。',
    },
    save: {
      title: '保存',
      text: '入力内容を保存します。保存後、一覧画面に反映されます。',
    },
    inneritem: {
      title: 'スクロール内ボタン',
      text: '内側スクロールコンテナの中にある要素です。コンテナをスクロールしてもマーカーが追従します。',
    },
    fixedbar: {
      title: '固定バー',
      text: 'position: fixed のバー上のボタンです。ページをスクロールしてもマーカーが追従します。',
    },
    modalfield: {
      title: 'モーダル内の項目',
      text: 'モーダル内の要素にもマーカーが付きます。',
    },
    shadowbtn: {
      title: 'Shadow DOM内ボタン',
      text: 'Shadow DOM の中にある要素です。境界を越えてマーカーが追従します。',
    },
    dynamic: {
      title: '動的に追加された行',
      text: '解説モードON中に追加された要素です。MutationObserverで検知してマーカーを付けています。',
    },
    multiline: {
      title: '複数行の説明',
      text: '本文の \\n は改行として表示されます。\n1行目\n2行目\nテキスト描画のままなので XSS リスクはありません。',
    },
    richlink: {
      title: 'render での自前描画',
      text: '（render が無ければこのテキストが表示されます）',
    },
    hostevent: {
      title: 'ホスト側イベント',
      text: '解説モード中は、このボタンのクリックは元アプリへ届きません。既存のイベントを外さず、透明レイヤーで操作を吸収します。',
    },
    keyevent: {
      title: 'キー入力の遮断',
      text: '解説モード中は、ホスト側フォームへのキー入力も抑止されます。Escape はポップアップを閉じる/解説モードを終了する操作として使えます。',
    },
    apitarget: {
      title: 'API から開く対象',
      text: 'open("apitarget") で、この説明をプログラムから開けます。close() や update() と組み合わせて、アプリ側の状態に合わせて制御できます。',
    },
    __free_001: {
      title: 'この画面について',
      text: '追従・動的・Shadow DOM・モーダル・a11y を確認するデモ画面です。',
      position: { top: 80, left: 560 },
    },
  },
};

/**
 * @param {'en'|'ja'} lang
 * @returns {import('../src/config.js').HelpConfig}
 */
export function buildHelpConfig(lang) {
  return CONTENT[lang] ?? CONTENT.en;
}
