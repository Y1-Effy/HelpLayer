/**
 * Strings for the demo "value layer" (hero pitch + first-run coach + mode/marker status), shared by
 * the Vanilla / React / Vue demos so the showcase wording stays in one place. The HelpLayer library
 * itself is not involved here — this is demo-only chrome. Language selection reuses i18n.js.
 */

export const SHOWCASE_STRINGS = {
  en: {
    heroTagline: 'Drop-in, framework-agnostic in-app help — without touching your existing code.',
    heroHint: 'This whole page is a normal app. Turn on help mode to reveal the explanations.',
    // First-run coach: step 1 points at the toggle (OFF), step 2 appears once ON.
    coachStep1: 'Start here: turn on help mode',
    coachStep2: 'Now click an "i" marker to read its explanation',
    statusOff: 'Help mode: OFF',
    statusOn: 'Help mode: ON',
    // {n} is replaced with the live count of DOM nodes HelpLayer has added (0 when OFF — proof of full teardown).
    domNodes: 'HelpLayer DOM: {n}',
    showCode: 'Show the code',
    copy: 'Copy',
    copied: 'Copied!',
    // Footer (adoption path): value chips, a11y note, install, links.
    valueChips: [
      '1 dependency · ~33KB',
      'Framework-agnostic',
      'Full teardown on OFF',
      'Accessible (a11y)',
      'CSP / Trusted Types ready',
      'Zero external requests',
    ],
    a11yNote: '⌨️ Keyboard-only friendly: Tab to a marker → Enter to open → Esc to close. The popup is role="dialog" with aria labels. Try it now.',
    installTitle: 'Install',
    linkGitHub: 'GitHub',
    linkNpm: 'npm',
    linkDocs: 'Docs',
  },
  ja: {
    heroTagline: '既存コードを変えずに後付けできる、フレームワーク非依存の「画面内ヘルプ」。',
    heroHint: 'この画面はふつうのアプリです。解説モードをONにすると説明が現れます。',
    coachStep1: 'まずはここ：解説モードをONにする',
    coachStep2: '出てきた「i」マーカーをクリックして説明を読む',
    statusOff: '解説モード：OFF',
    statusOn: '解説モード：ON',
    // {n} は HelpLayer が追加した DOM ノード数（OFF では 0＝完全後始末の証明）。
    domNodes: '追加DOM：{n}',
    showCode: 'コードを見る',
    copy: 'コピー',
    copied: 'コピーしました',
    // フッター（導入動線）：価値チップ・a11yノート・Install・リンク。
    valueChips: [
      '依存1つ・約33KB',
      'フレームワーク非依存',
      'OFFで完全後始末',
      'アクセシブル(a11y)',
      'CSP / Trusted Types 対応',
      '外部通信ゼロ',
    ],
    a11yNote: '⌨️ キーボードだけで操作可：Tab でマーカーへ → Enter で開く → Esc で閉じる。ポップアップは role="dialog"＋aria 対応。今すぐ試せます。',
    installTitle: '導入',
    linkGitHub: 'GitHub',
    linkNpm: 'npm',
    linkDocs: 'ドキュメント',
  },
};

/**
 * @param {'en'|'ja'} lang
 * @returns {typeof SHOWCASE_STRINGS['en']}
 */
export function showcaseStrings(lang) {
  return SHOWCASE_STRINGS[lang] ?? SHOWCASE_STRINGS.en;
}
