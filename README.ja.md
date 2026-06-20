# HelpLayer

[![npm](https://img.shields.io/npm/v/help-layer.svg)](https://www.npmjs.com/package/help-layer)
[![license](https://img.shields.io/npm/l/help-layer.svg)](./LICENSE)
[![repo](https://img.shields.io/badge/GitHub-Y1--Effy%2FHelpLayer-181717?logo=github)](https://github.com/Y1-Effy/HelpLayer)

[English](./README.md) | **日本語**

既存の Web アプリに**後付けできる、フレームワーク非依存の「解説モード」ライブラリ**です。
モード ON 中だけ対象要素の近くに「？」マーカーを出し、クリックで説明ポップアップを表示します。
元アプリのイベントには一切触れず、透明な遮断レイヤーで操作を吸収するので、既存コードを書き換えずに導入できます。

- 依存は [`@floating-ui/dom`](https://floating-ui.com/) のみ・軽量（プリビルドの IIFE で約 30KB / min、`@floating-ui/dom` 同梱）
- Shadow DOM 貫通・SPA の動的要素・マーカー同士の重なり回避・画面端でのポップアップ自動調整に対応
- ON→OFF で追加した DOM・イベント・スタイルを**完全後始末**

## インストール

```sh
npm install help-layer
```

バンドラを使わず `<script>` 1本で導入したい場合は、プリビルドの IIFE を読み込めばグローバル `HelpLayer` が生えます（後述）。

## クイックスタート

### 1. config オブジェクトで定義する

対象要素に `data-help-id` を付け、その値をキーにした説明を渡します。

```html
<button data-help-id="save">保存</button>
<button id="help-toggle">解説モード</button>
```

```js
import { initHelpLayer } from 'help-layer';

initHelpLayer({
  toggle: '#help-toggle',
  config: {
    save: { title: '保存', text: '入力内容を保存します。' },
  },
});
```

### 2. マークアップに直接書く（config なしでも可）

説明をマークアップと同居させたい場合は、`data-help-title` / `data-help-text` を要素に直接書くだけで対象になります。
`config` と併用でき、**同じキーが config にあれば config が優先**されます。

```html
<button data-help-title="保存" data-help-text="入力内容を保存します。">保存</button>
```

```js
initHelpLayer({ toggle: '#help-toggle', config: {} });
```

### `<script>` だけで使う（バンドラなし）

CDN から読む場合は、改ざん検知のため **バージョンを固定** し、**SRI（`integrity`）** を付けることを推奨します。

```html
<script
  src="https://unpkg.com/help-layer@1.0.0/dist/help-layer.iife.js"
  integrity="sha384-……（公開版のハッシュに差し替え）"
  crossorigin="anonymous"></script>
<script>
  HelpLayer.initHelpLayer({
    toggle: '#help-toggle',
    config: { save: { title: '保存', text: '入力内容を保存します。' } },
  });
</script>
```

> `integrity` のハッシュは公開した実ファイルから生成します。例:
> `curl -s https://unpkg.com/help-layer@1.0.0/dist/help-layer.iife.js | openssl dgst -sha384 -binary | openssl base64 -A`
> （バージョンを固定しないと SRI と不整合になり読み込みが拒否されます。）

## 自由配置（要素に紐づけない説明）

`position` を指定すると、特定要素ではなくページ座標にマーカーを置けます（画面全体の説明などに）。

```js
config: {
  intro: { title: 'この画面について', text: '…', position: { top: 80, left: 560 } },
}
```

## API

```js
const help = initHelpLayer(options);
help.enable();   // ON
help.disable();  // OFF
help.toggle();   // 反転
help.isActive(); // boolean
help.open(key);  // 指定キーの説明を開く（OFF 中なら自動で ON）
help.close();    // 開いている説明を閉じる（モードは ON のまま）
help.update(newConfig); // config を差し替え（ON 中なら無音で再構築。onEnable/onDisable は呼ばれない）
help.destroy();  // リスナー解除＋完全後始末
```

### options

| オプション | 型 | 既定 | 説明 |
|------|------|------|------|
| `config` | `object` | （必須） | キー→`{ title, text, position? }`。`data-help-id` 値 or 自由配置キー |
| `toggle` | `string \| HTMLElement` | なし | ON/OFF するトグル要素。省略時は API 制御のみ |
| `attribute` | `string` | `'data-help-id'` | 対象を示す属性名 |
| `render` | `(record) => Node \| null` | なし | 本文を自前 DOM で描画。返り値が無ければ安全なテキスト表示にフォールバック（タイトルは常に `record.title`） |
| `markerLabel` | `string` | `'?'` | マーカーに表示する文字 |
| `markerPlacement` | `Placement` | `'top-end'` | マーカーを重ねる隅（`top-end`/`top-start`/`bottom-end`/`bottom-start`） |
| `popupPlacement` | `Placement` | `'bottom-start'` | ポップアップ初期配置（画面端では自動で flip/shift） |
| `nonce` | `string` | なし | 厳格な CSP（`style-src 'nonce-…'`）下で注入 `<style>` を許可するための nonce（後述） |
| `silent` | `boolean` | `false` | 未登録キーの警告ログを抑止 |

### コールバック

| オプション | タイミング |
|------|------|
| `onEnable` | モードを ON にした直後 |
| `onDisable` | モードを OFF にした直後 |
| `onOpen(record)` | 説明ポップアップを開いた時 |
| `onClose` | 説明ポップアップを閉じた時 |

> ※ ON 中に説明を開いたまま `update()` / `disable()` / `destroy()` すると、後始末で説明が閉じるため `onClose` が一度発火します。

### 本文に改行を入れる / リンクを置く

本文は安全のため既定で `textContent`（HTML を解釈しない）ですが、`\n` は改行として表示されます。
リンクや装飾が必要なら `render` で任意の DOM を返してください。

```js
initHelpLayer({
  config,
  render(record) {
    if (record.key !== 'save') {
      return null; // 既定のテキスト表示にフォールバック
    }
    const a = document.createElement('a');
    a.href = '/docs/save';
    a.textContent = 'くわしくはこちら';
    return a;
  },
});
```

> ⚠️ **セキュリティ:** `render` が返した DOM は**そのまま挿入され、ライブラリ側ではサニタイズしません**。
> ユーザー入力など未信頼のデータを使う場合は、`innerHTML` で組み立てず `textContent` を使うか、
> [DOMPurify](https://github.com/cure53/DOMPurify) 等で無害化してから返してください（XSS 防止）。
> 既定（`render` 未指定）の `title`/`text` 描画は `textContent` なので安全です。

## テーマ（CSS カスタムプロパティ）

見た目はホスト側 CSS で以下の変数を上書きするだけで変えられます。ダークモード（`prefers-color-scheme: dark`）の
既定値も内蔵していますが、変数を指定すればそちらが常に優先されます。

| 変数 | 既定 | 用途 |
|------|------|------|
| `--help-layer-marker-size` | `22px` | マーカー直径 |
| `--help-layer-marker-bg` | `#2563eb` | マーカー背景色 |
| `--help-layer-marker-color` | `#fff` | マーカー文字色 |
| `--help-layer-popup-bg` | `#fff` | ポップアップ背景色 |
| `--help-layer-popup-color` | `#1f2933` | ポップアップ文字色 |
| `--help-layer-popup-max-width` | `280px` | ポップアップ最大幅 |
| `--help-layer-popup-max-height` | `50vh` | ポップアップ本文の最大高さ（超過時は本文のみスクロール） |
| `--help-layer-accent` | `#1d4ed8` | フォーカスリング色 |
| `--help-layer-overlay-bg` | `transparent` | 遮断レイヤー（スクリム）背景色。`rgba(0,0,0,0.15)` 等で操作不能状態を可視化 |
| `--help-layer-overlay-cursor` | `default` | 遮断領域上のカーソル。`not-allowed` / `help` 等 |

## 既知の制約

- closed な Shadow DOM は JS から到達できないため非対応（open のみ貫通）。
- マーカーを隅へ重ねるオフセットは既定マーカーサイズ（22px）前提。`--help-layer-marker-size` を大きく変えると
  わずかにズレることがあります。

## セキュリティ

- 設計上、`title` / `text` の描画は `textContent` のみで、`innerHTML` / `eval` / `new Function` は**一切使いません**。
- 外部通信（`fetch` 等）・`localStorage` / `cookie` などのストレージ利用も**ありません**（完全ローカル動作）。
- 唯一、未信頼データが DOM に届きうる経路は `render` オプションです。戻り値はサニタイズされないため、
  ユーザー入力を含む場合は呼び出し側で無害化してください（上記「本文に改行を入れる / リンクを置く」参照）。
- ランタイム依存は `@floating-ui/dom` のみ。CDN 利用時は前述のとおりバージョン固定＋SRI を推奨します。

### Content Security Policy（CSP）

本ライブラリは `innerHTML` / `eval` を使わないため **Trusted Types（`require-trusted-types-for 'script'`）に
そのまま対応** しています。位置決めは要素の `.style`（CSSOM）への直接代入で行うため CSP の対象外です。

一点だけ注意が必要なのは、見た目用に注入する **`<style>` タグ** です。`style-src` に `'unsafe-inline'` も
nonce も無い**厳格な CSP** ではこの `<style>` がブロックされ、マーカーやポップアップのスタイルが当たりません。
`style-src 'nonce-…'` 運用のサイトでは、リクエストごとの nonce を `nonce` オプションで渡してください。

```js
// サーバが毎リクエスト発行する nonce（CSP ヘッダの style-src 'nonce-xxxx' と同じ値）を渡す
initHelpLayer({ config, toggle: '#help-toggle', nonce: pageNonce });
```

これで注入される `<style nonce="xxxx">` が CSP に許可され、厳格 CSP 下でも正しく表示されます。
`'unsafe-inline'` を許可しているサイトや CSP 未設定のサイトでは `nonce` は不要です。

## 開発

| 目的 | コマンド |
|------|----------|
| テスト | `npm test` |
| Lint / 型チェック / 一括 | `npm run lint` / `npm run typecheck` / `npm run check` |
| デモ起動 | `npm run demo` |
| 配布物ビルド | `npm run build`（`dist/` に ESM・IIFE・型定義） |

## リポジトリ

- ソース: <https://github.com/Y1-Effy/HelpLayer>
- バグ報告・要望: <https://github.com/Y1-Effy/HelpLayer/issues>
- ライセンス: [ISC](./LICENSE)
