# HelpLayer

[![npm](https://img.shields.io/npm/v/help-layer.svg)](https://www.npmjs.com/package/help-layer)
[![license](https://img.shields.io/npm/l/help-layer.svg)](./LICENSE)
[![repo](https://img.shields.io/badge/GitHub-Y1--Effy%2FHelpLayer-181717?logo=github)](https://github.com/Y1-Effy/HelpLayer)
[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Y1-Effy/f1479376394b26b678f9e97095d88d95/raw/coverage.json)](https://github.com/Y1-Effy/HelpLayer/actions/workflows/ci.yml)

[English](./README.md) | **日本語**

🔗 **ライブデモ: <https://y1-effy.github.io/HelpLayer/>**（Vanilla / React / Vue。右上の「解説モード」を ON にして「i」をクリック）

![HelpLayer の動作デモ：解説モードを ON にすると対象要素の近くにマーカー（このデモでは「i」、既定は「？」）が現れ、クリックすると説明ポップアップが開く。OFF にすると追加した DOM はすべて消える様子](./assets/demo.gif)

既存の Web アプリに、**既存コードを書き換えずに「画面内ヘルプ」を後付けできる**、フレームワーク非依存のライブラリです。
ユーザーが「解説モード」を ON にしている間だけ、知りたい要素の「？」マーカーをクリックして説明を読めます。通常時の見た目は一切変わりません。
仕組みは透明な遮断レイヤー — 対象要素の近くにマーカーを出しつつ、元アプリのイベントには一切触れずに操作を吸収します。

- 実行時依存ゼロ・軽量（プリビルドの IIFE で約 20KB minified）
- Shadow DOM 貫通・SPA の動的要素・マーカー同士の重なり回避・画面端でのポップアップ自動調整に対応
- キーボード操作・スクリーンリーダーに配慮（ポップアップは `role="dialog"`、開くとフォーカスを移し閉じるとマーカーへ復帰。モード中はフォーカスを UI 内に封じ込め、`Esc` で説明を閉じる（開いている説明が無ければ解説モード自体を終了））
- ON→OFF で追加した DOM・イベント・スタイルを**完全後始末**
- モダンブラウザ（Chromium / Firefox / WebKit）で動作（e2e を 3 エンジンで検証）

## 目次

- [なぜ HelpLayer か（既存手段との違い）](#なぜ-helplayer-か既存手段との違い)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [こんなときに（導入が刺さるケース）](#こんなときに導入が刺さるケース)
- [自由配置（要素に紐づけない説明）](#自由配置要素に紐づけない説明)
- [API](#api)
- [API の上に作るレシピ（分析・ディープリンク・検索・フレームワーク連携）](./RECIPES.ja.md)
- [テーマ（CSS カスタムプロパティ）](#テーマcss-カスタムプロパティ)
- [対応環境（ブラウザ／ランタイム）](#対応環境ブラウザランタイム)
- [既知の制約](#既知の制約)
- [パフォーマンス（マーカー数の目安）](#パフォーマンスマーカー数の目安)
- [アクセシビリティ](#アクセシビリティ)
- [セキュリティ](#セキュリティ)
- [開発](#開発)

## なぜ HelpLayer か（既存手段との違い）

画面に説明を足す手段はいくつもありますが、それぞれ別の前提を抱えています。HelpLayer は
**「ユーザーが知りたい箇所だけを、その場で自由に選んで確認できる解説モード」** に振り切ることで、
通常時の見た目も既存コードも一切犠牲にしないことを狙っています。

- **プロダクトツアー型（ステップ案内）との違い** … 決められた順路を上から押し付けるのではなく、
  ユーザーが見たい要素を選んでその場で開ける **探索型**。読み終えたいタイミングも順序もユーザーに委ねます。
- **常設ツールチップとの違い** … 説明を常時表示してUIを煩雑にすることがありません。マーカーは
  **モードON中だけ**出るので、**通常時のデザインは一切変わりません**。
- **DAP系SaaS（Digital Adoption Platform＝定着化支援 SaaS）との違い**
  … 外部基盤・契約・トラッキングを必要とせず、**ランニングコスト0・依存ゼロ・約20KB の完全ローカル動作**。
  CSP / Trusted Types にも対応するため、持ち込み制約の厳しい環境にも入ります。

そのうえで共通の核として、**既存コードを書き換えずに後付け**でき、**フレームワーク非依存**で、
元アプリのイベントには触れず（透明な遮断レイヤーで操作を吸収）、**ON→OFF で完全に後始末**します。

| | プロダクトツアー型 | 常設ツールチップ | DAP系SaaS | **HelpLayer** |
|---|---|---|---|---|
| 提示形式 | 線形ステップになりがち | 常時表示になりがち | サービス依存 | **モードON中だけ・任意箇所を探索** |
| 通常時のUI | 実装次第 | 煩雑になりがち | 実装次第 | **一切変えない** |
| 導入方法 | 多くは要組み込み | CSS/JS を追記 | スニペット＋外部基盤＋契約 | **後付け・既存コード非改変** |
| コスト／運用 | 実装次第 | ローカル | 月額＋トラッキング運用 | **ランニング0・依存ゼロ** |

> ※ HelpLayer は DAP の **フル代替ではありません**。アナリティクスやセグメント別配信、複雑なフロー誘導・
> オンボーディング自動化といった高機能は対象外で、**「画面内に説明を出す」というコア機能だけを最小コストで満たす**ことに
> 振り切っています。逆に、強い導線を引きたい・利用状況を計測したいといった目的が主なら、DAP やツアーの方が向きます。
>
> とはいえ、これらのいくつか（分析・ディープリンク・検索パネル・フレームワーク連携）は、公開 API の
> *上に* 数行で作れます。レシピは **[RECIPES.ja.md](./RECIPES.ja.md)** を参照してください。

## インストール

```sh
npm install help-layer
```

バンドラを使わず `<script>` 1本で導入したい場合は、プリビルドの IIFE を読み込めばグローバル `HelpLayer` が生えます（後述）。

TypeScript の型定義を同梱しています（`package.json` の `types` が `dist/types` を指す）。TS プロジェクトでは追加設定なしで型補完が効きます。公開型は import 可能です（例: `import type { HelpLayerOptions, HelpLayerController, HelpConfig, HelpRecord, Placement } from 'help-layer'`）。

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

### 2. マークアップに直接書く（`config` 不要）

説明をマークアップと同居させたい場合は、`data-help-title` / `data-help-text` を要素に直接書くだけで対象になります。
`config` と併用でき、**同じキーが config にあれば config が優先**されます。

```html
<button data-help-title="保存" data-help-text="入力内容を保存します。">保存</button>
```

```js
initHelpLayer({ toggle: '#help-toggle' });
```

### `<script>` だけで使う（バンドラなし）

CDN から読む場合は、改ざん検知のため **バージョンを固定** し、**SRI（`integrity`）** を付けることを推奨します。

```html
<script
  src="https://unpkg.com/help-layer@1.3.0/dist/help-layer.iife.js"
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
> `curl -s https://unpkg.com/help-layer@1.3.0/dist/help-layer.iife.js | openssl dgst -sha384 -binary | openssl base64 -A`
> （バージョンを固定しないと SRI と不整合になり読み込みが拒否されます。）

## こんなときに（導入が刺さるケース）

- **DAP／ガイド系 SaaS のコストが見合わず、解約を検討している。でも解約すると画面内ヘルプがゼロに戻る。**
  → 「画面内に説明を出す」というコア機能だけを、依存ゼロ・ランニングコスト0 で自前に残せます。乗り換え後の受け皿に。
- **SaaS を契約する予算感はないが、ヘルプは拡張したい。**
  → npm か `<script>` 1本で後付け。月額もアカウントも要りません。
- **オフィスソフトで別途マニュアルを作る・更新するのが重い。しかも作っても読まれない。**
  → 説明を画面内のその要素に同居させます（`data-help-title`／`data-help-text` か小さな config だけ）。
  別ドキュメントの保守から解放され、UI と説明がズレません。
- **オンボーディングは欲しいが、強制的なツアーは押し付けがましい**ので避けたい。
  → ユーザーが見たい箇所を選んでその場で開く探索型なので、操作を中断させません。
- **外部 SaaS を持ち込めない環境**（厳格な CSP・プライバシー要件・閉域網・トラッキング不可）。
  → 外部通信なしの完全ローカル動作で要件を満たします。
- **React / Vue などフレームワークを問わず**、描画ライブラリにも手を入れずに導入したい。
  → フレームワーク非依存・後付けで、既存コードを書き換えません。

> 業務システム・管理画面は最初に刺さりやすい例として挙げていますが、用途はそこに限りません。
> もちろん **一般的な Web サイト** でも、申込み・問い合わせ・予約などのフォームで「この項目に何を入れるか」を
> マーカー＋ポップアップで補えます。「説明を後付けしたい既存 Web ページ」全般が対象で、別途マニュアルを
> 用意する運用の軽い代替にもなります。

> 💡 **デスクトップアプリにも使えます。** Electron / Tauri などはアプリ画面を WebView（HTML/DOM）で描画して
> いるため、Web アプリとまったく同じ感覚で HelpLayer を後付けできます。ネイティブ風の画面に「解説モード」を
> 足したいときの選択肢としても、意外と素直にハマります。

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
help.open(key);  // 指定キーの説明を開く（OFF 中なら自動で ON）。
                 // 同じ data-help-id を複数要素が持つ場合は最初の1つ（mount 順）を開き、警告を出す。
help.close();    // 開いている説明を閉じる（モードは ON のまま）
help.update(newConfig); // config を差し替え（ON 中なら無音で再構築。onEnable/onDisable は呼ばれない）
help.diagnose(); // 実 DOM を走査し config の対応状況をログ＋返却（ON/OFF どちらでも）
help.destroy();  // リスナー解除＋完全後始末
```

### options

| オプション | 型 | 既定 | 説明 |
|------|------|------|------|
| `config` | `object` | `{}` | キー→`{ title, text, position? }`。`data-help-id` 値 or 自由配置キー。任意（省略時はインライン `data-help-title` / `data-help-text` のみで対象化） |
| `toggle` | `string \| HTMLElement` | なし | ON/OFF するトグル要素。省略時は API 制御のみ |
| `attribute` | `string` | `'data-help-id'` | 対象を示す属性名 |
| `render` | `(record) => Node \| null` | なし | 本文を自前 DOM で描画。返り値が無ければ安全なテキスト表示にフォールバック（タイトルは常に `record.title`） |
| `markerLabel` | `string` | `'?'` | マーカーに表示する文字 |
| `markerPlacement` | `Placement` | `'top-end'` | マーカーを対象に重ねる位置。任意の `Placement` 値（`popupPlacement` と同じ12種）。`top-end`/`bottom-start` などの隅が一般的 |
| `popupPlacement` | `Placement` | `'bottom-start'` | ポップアップ初期配置（画面端では自動で flip/shift） |
| `markerAriaLabel` | `(title: string) => string` | `` `Help: ${title}` `` | マーカーの `aria-label` をタイトルから生成。スクリーンリーダーの読み上げをローカライズ |
| `closeLabel` | `string` | `'Close'` | ポップアップの閉じる（×）ボタンの `aria-label`。スクリーンリーダーの読み上げをローカライズ |
| `nonce` | `string` | なし | 厳格な CSP（`style-src 'nonce-…'`）下で注入 `<style>` を許可するための nonce（後述） |
| `silent` | `boolean` | `false` | 非致命の警告ログを抑止（未登録キー・未知オプション・同一id の open） |
| `debug` | `boolean` | `false` | 開発補助: `diagnose()` を `window.helpLayerDiagnose` としても公開 |

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
| `--help-layer-marker-size` | `24px` | マーカー直径（WCAG 2.5.8 の最小ターゲットサイズに合わせた既定） |
| `--help-layer-marker-bg` | `#2563eb` | マーカー背景色 |
| `--help-layer-marker-color` | `#fff` | マーカー文字色 |
| `--help-layer-popup-bg` | `#fff` | ポップアップ背景色 |
| `--help-layer-popup-color` | `#1f2933` | ポップアップ文字色 |
| `--help-layer-popup-max-width` | `280px` | ポップアップ最大幅 |
| `--help-layer-popup-max-height` | `50vh` | ポップアップ本文の最大高さ（超過時は本文のみスクロール） |
| `--help-layer-accent` | `#1d4ed8` | フォーカスリング色 |
| `--help-layer-overlay-bg` | `transparent` | 遮断レイヤー（スクリム）背景色。`rgba(0,0,0,0.15)` 等で操作不能状態を可視化 |
| `--help-layer-overlay-cursor` | `default` | 遮断領域上のカーソル。`not-allowed` / `help` 等 |

## 対応環境（ブラウザ／ランタイム）

HelpLayer は **現代的な evergreen ブラウザ**（Chrome / Edge・Firefox・Safari）と近年の Electron の
Chromium を対象とします。**IE11 は非対応であり、構造上対応できません** — ES2020 構文・ES Modules・
Shadow DOM・`clip-path` に依存しており、IE はいずれも備えていないためです。これは
パッケージ形式の調整では埋められません。本当に古いランタイムを対象とする必要がある場合、本ライブラリは
適合しません。

下限を決める要素（新しい2つの API は縮退するため、実質的なハード下限はおよそ **2020 年代の evergreen**）:

| 機能 | 用途 | 下限の目安 | フォールバック |
|---|---|---|---|
| ES2020＋ES Modules | ライブラリ全体 | evergreen（〜2020） | なし（古い対象はトランスパイル／バンドルが必要） |
| `requestAnimationFrame` | マーカー／ポップアップの自動配置（毎フレーム追従） | evergreen | なし |
| open Shadow DOM 貫通 | shadow root 内の対象探索 | evergreen | closed は設計上非対応 |
| `clip-path: polygon()` | 遮断レイヤーのトグル「穴」 | evergreen（極端に古い Safari は `-webkit-` 必要） | なし |
| `inert` | ホストを a11y ツリーから除外 | Chrome102 / FF112 / Safari15.5（2023） | 視覚＋キーボード遮断のみに縮退 |
| `Element.checkVisibility()` | 対象が隠れた時にマーカーも隠す | Chrome105 / FF125 / Safari17.4（2024） | 0×0 rect 判定に縮退（`display:none` のみ検出） |

### モジュール形式

- **ESM（既定）**: `import { initHelpLayer } from 'help-layer'` はビルド済み・テスト済みの
  `dist/help-layer.esm.js` を解決します（自己完結・解決すべき実行時依存なし）。
- **バンドラ無し／`<script>`／CDN／厳格環境**: グローバル `HelpLayer` を公開する
  自己完結の IIFE ビルドを使用 — [`<script>` だけで使う](#script-だけで使うバンドラなし) 参照。
- **CommonJS（`require`）**: `require` 入口は提供しません。ブラウザ DOM 専用のため Node の CJS 文脈では
  意味を持ちません。非 ESM のツールチェーンではバンドラ経由で ESM を取り込むか、上記 IIFE を読み込んでください。

## 既知の制約

- closed な Shadow DOM は JS から到達できないため非対応（open のみ貫通）。
- マーカーを隅へ重ねるオフセットは既定マーカーサイズ（24px）前提。`--help-layer-marker-size` を大きく変えると
  わずかにズレることがあります。
- **対象要素の「状態」変化は監視しません**（監視するのは「レイアウト」と「DOM 上の有無」のみ）。ON 中、
  マーカーは対象の位置・サイズ変化に追従し、DOM への追加／削除に応じて mount／unmount され、対象自体が
  隠れる／現れる（`display:none` 等）とマーカーも隠れる／戻ります。一方で、対象の**属性・内容の変化**は
  検知しません — 既存要素への `data-help-id` の後付け／除去、`data-help-title` `data-help-text` の書き換え、
  `disabled` 等の状態切り替えはマーカーに反映されません。これは意図的な制約です。文書全体に属性監視
  （`MutationObserver` の `attributes: true, subtree: true`）を張ると、あらゆるクラス／スタイル変更で発火し、
  ドロップイン型ライブラリとしては性能上のアンチパターンになるためです。これらの状態を変えた場合は、
  `update(config)` で作り直す、モードを OFF→ON する、または対象要素を一度 DOM から外して入れ直してください
  （入れ直しは `childList` 監視に乗ります）。

## パフォーマンス（マーカー数の目安）

コストは **同時に表示しているマーカー数** に比例します（登録した `config` の総数ではありません）。
表示中の全マーカーは **1 本の共有 `requestAnimationFrame` ループ** でまとめて配置します（マーカーごとの
監視や外部の配置ライブラリは使いません）。そのためスクロール中・アニメーション中も、1 フレームにつき
表示中マーカーをまとめた read → compute → write の 1 パスだけが走ります。
マーカーは **モード ON 中、かつ DOM 上に存在して表示されている対象にのみ** 出ます。`display:none`
などで隠れた対象（`checkVisibility` が「隠れている」と判定した対象）のマーカーは、再配置・レイアウト
計測・重なり回避のいずれからも除外されます。つまり効いてくるのは「いま画面に出ている数」です。

マーカー同士の重なり回避は 1 パスあたり `O(n²)` ですが、反復回数に上限があり定数も小さく、かつ実際に
動いたフレームだけ実行されます。1 パスで読む矩形は表示中の参照要素ぶん各 1 回のみ（read と write を
フェーズ分離するのでレイアウトスラッシングは起きません）。規模で最初に効いてくるのは、表示中マーカー数
に比例して増える毎フレームの追従コストのほうです。

目安（**同時に表示する**マーカー数）:

- **数百個まで** … 一般的な端末で快適。
- **〜1000 個** … 私たちのテストでも滑らか（同梱の[ストレスページ](./demo/stress.html)で自動スクロール中も 60fps を維持）。
- **それを大きく超える** … スクロール／アニメ中の毎フレーム追従コストがいずれ目立ち始めます。

**再現方法。** 上の数値は同梱のストレスページ（[`demo/stress.html`](./demo/stress.html)。`npm run demo`
を実行して <http://localhost:5500/demo/stress.html> を開く、または公開版
<https://y1-effy.github.io/HelpLayer/stress.html>）によるものです。解説モードを ON にし、マーカー数
（100〜1000）を選んで **Auto-scroll** を有効化します。これは表示中の全マーカーが毎フレーム再追従する
**最悪ケース**です。メーターは `requestAnimationFrame` のデルタの移動平均を frame **ms**／**fps** として
表示します。数値はブラウザ／CPU／ズームで変わるので **自分の対象端末で測ってください**。ビルドの比較は
ページの下でソースを差し替えて（例: `git stash`）行えます。記載の数値は特定の基準マシンではなく、私たち自身の
計測環境によるものです。

とはいえこのモードは **探索型**（利用者が見たい箇所を選ぶ）なので、一画面に数十個もあれば十分なことが
ほとんどです。大規模ページでは対象を絞る、ページ／タブ単位で出し分ける（`update(config)` でセットを
差し替える、別の `attribute` を使う等）として、同時に出す数を抑えるとよいでしょう。これは
[既知の制約](#既知の制約) で文書全体に属性監視を張らない選択をしたのと同じ理由 — どちらも「割に合わない
毎フレーム処理」を避けるためです。

## アクセシビリティ

モード ON 中は、ホストアプリを視覚・ポインタ／キーボードだけでなく **支援技術（AT）に対しても意味的に
無効化**します。ホストを [`inert`](https://developer.mozilla.org/ja/docs/Web/HTML/Global_attributes/inert)
属性で a11y ツリーから除外するため、スクリーンリーダーの仮想カーソル（ブラウズモード）でも背景の読み上げ・
操作ができません。到達できるのはヘルプマーカー・ポップアップ・トグルのみです。ポップアップは
`aria-modal="true"` を持つ `role="dialog"` で、開くとフォーカスが移り、閉じるとマーカーへ戻ります。

この隔離の限定事項:

- `inert` は inert なサブツリーの子孫で打ち消せないため、隔離は document body の直下レベルで適用します
  （トグルを透過させる clip-path の"穴"と同じ考え方）。トグルは操作可能である必要があるので、
  **トグルを含む body 直下ブランチは到達可能なまま残します** — 漏れを最小化するにはトグルを body 直下
  （または近い位置）に置いてください（直下の `<body>` 子要素なら漏れゼロ）。
- `inert` は現行ブラウザで広くサポートされます。非対応環境でも視覚／キーボードの遮断は有効で、AT 除外だけが
  グレースフルに縮退します（エラーにはなりません）。

## セキュリティ

脆弱性の報告方法・サポート方針・セキュリティリリース方針は [SECURITY.ja.md](./SECURITY.ja.md) を参照してください。報告は公開 issue ではなく GitHub の非公開脆弱性報告をご利用ください。

- 設計上、`title` / `text` の描画は `textContent` のみで、`innerHTML` / `eval` / `new Function` は**一切使いません**。
- 外部通信（`fetch` 等）・`localStorage` / `cookie` などのストレージ利用も**ありません**（完全ローカル動作）。
- 唯一、未信頼データを HTML／DOM ノードとして挿入しうる経路は `render` オプションです。戻り値はサニタイズされないため、
  ユーザー入力を含む場合は呼び出し側で無害化してください（上記「本文に改行を入れる / リンクを置く」参照）。
- 実行時依存はありません。CDN 利用時は前述のとおりバージョン固定＋SRI を推奨します。

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

## 設定監査 CLI（`help-layer check`）

`helpConfig` と markup の `data-help-id` がちゃんと噛み合っているかを、**アプリを起動せず**ターミナルで
一発確認できます。ソースを走査して `data-help-id` の文字列リテラルを集め、config と突き合わせるので、
タイポや定義もれをエディタ作業の最中に（あるいは CI で）見つけられます。

```bash
npx help-layer check --config ./src/helpConfig.js --src ./src
```

| オプション | 意味 |
|------|----------|
| `--config <path>` | config ファイル。`.json`、または `.js`/`.mjs` モジュール（default / `--export` の名前付き / 引数なしで呼べる factory 関数）。 |
| `--src <path...>` | 走査するソースのルート（複数可・カンマ区切り可）。既定はカレントディレクトリ。 |
| `--ext <list>` | 走査する拡張子（カンマ区切り）。既定: `html,htm,jsx,tsx,vue,js,ts,mjs,svelte`。 |
| `--export <name>` | config を持つ export 名（関数なら引数なしで呼ぶ）。 |
| `--attribute <attr>` | 対象属性名（既定 `data-help-id`）。 |
| `--strict` | エラーだけでなく警告でも非ゼロ終了。 |

出力カテゴリ: **bound**（config ↔ markup 紐づけ済み）、**free**（位置指定エントリ）、**inline**
（`data-help-title`/`data-help-text` で成立・config なし）、**unusedConfig**（*警告*: config にあるが markup
で未出現＝タイポ or 動的id）、**missingConfig**（*エラー*: id はあるが config もインライン定義も無く、マーカーが
出ない）。エラーがあれば終了コード `1`（`--strict` なら警告でも `1`）で、CI ゲートに使えます。

> 静的解析なので拾えるのは**文字列リテラル**の id だけです。`data-help-id={expr}` のような動的 id は解決
> できず、その config キーは `unusedConfig`（エラーではなく警告）に出ます。

### markup から config 雛形を生成（`help-layer scaffold`）

既存アプリへの後付け導入時に、markup にある `data-help-id` から config 雛形を生成し、文言を埋めるだけにできます。
インライン `data-help-title` / `data-help-text` があれば値を事前穴埋めします。

```bash
help-layer scaffold --src ./src > helpConfig.js        # 全 id の雛形を標準出力へ
help-layer scaffold --src ./src --out helpConfig.js    # ...またはファイルに書き出し
help-layer scaffold --src ./src --config ./helpConfig.js --export buildHelpConfig  # 未定義 id だけ
```

既定は JS モジュール（`export const helpConfig = { … }`）。`--format json` で JSON。既存 `--config` を渡すと
**未定義の id だけ**を雛形化します。

### ランタイム診断（`controller.diagnose()`）

CLI は静的なので、**実行時の DOM**（動的 id・SPA で後から増えた要素）は controller の `diagnose()` で確認します。
現在の DOM を走査し、表でログ出力しつつレポートオブジェクトを返します:

```js
const help = initHelpLayer({ config, toggle: '#help', debug: true });
help.diagnose();        // ログ＋ { bound, inline, missingConfig, unmatchedConfig, free, summary } を返す
```

`debug: true` なら `window.helpLayerDiagnose()` としても公開され、devtools コンソールから直接叩けます。
解説モードの ON/OFF を問わず動作します。CI は CLI、ブラウザでのデバッグは `diagnose()`、と補完しあう想定です。

> `unmatchedConfig` は CLI の `unusedConfig` のランタイム版です（対応する要素が——ここでは実 DOM に——無い config キー）。

## 開発

| 目的 | コマンド |
|------|----------|
| テスト | `npm test` |
| Lint / 型チェック / 一括 | `npm run lint` / `npm run typecheck` / `npm run check` |
| デモ起動 | `npm run demo`（パフォーマンス計測は `/demo/stress.html` を開く） |
| 配布物ビルド | `npm run build`（`dist/` に ESM・IIFE・型定義） |

## リポジトリ

- ソース: <https://github.com/Y1-Effy/HelpLayer>
- バグ報告・要望: <https://github.com/Y1-Effy/HelpLayer/issues>
- 変更履歴: [CHANGELOG.md](./CHANGELOG.md)
- ライセンス: [ISC](./LICENSE)
