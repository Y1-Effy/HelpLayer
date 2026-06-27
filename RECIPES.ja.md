# HelpLayer — 公開 API の上に作るレシピ集

[English](./RECIPES.md) | **日本語**

HelpLayer はコアをあえて小さく保っています。トグルで切り替える「ヘルプモード」、マーカーから開く
説明ポップアップ、そして OFF 時の完全クリーンアップ。アナリティクス・ディープリンク・検索パネル・
フレームワーク連携などは **ライブラリとしては意図的に対象外**です（[README](./README.ja.md#なぜ-helplayer-か既存手段との違い)
の DAP 注記を参照）。

ただし「コアの対象外」＝「実現が大変」ではありません。公開 API は **ライフサイクルのコールバック＋
`open(key)` ハンドル**という小さく組み合わせ可能な継ぎ目になっているので、上記はどれも **その上に数行で、
フォークもコア改修もなしに**作れます。本書はそうしたレシピを4つ集めたものです。

ここで使うのは公開 API だけです。

```js
const help = initHelpLayer(options);
help.open(key);         // key の項目を開く（OFF なら自動で ON にする）
help.close();           // 開いているポップアップを閉じる（モードは ON のまま）
help.update(config);    // config を差し替え（ON 中は再構築）
help.destroy();         // リスナー解除＋完全クリーンアップ
help.isActive();        // boolean
```

…そして次のコールバックです。

| コールバック | 発火タイミング |
|---|---|
| `onEnable` | モードが ON になった直後 |
| `onDisable` | モードが OFF になった直後 |
| `onOpen(record)` | 説明ポップアップが開いた時 |
| `onClose` | 説明ポップアップが閉じた時 |

`record` には `key`（安定した config キー文字列）・`title`・`kind`（`'element' \| 'free'`）が入ります。
詳細は [README の API セクション](./README.ja.md#api) を参照してください。

---

## 1. アナリティクス：モード切替回数と項目ごとの表示回数を集計する

4つのコールバックは計装の継ぎ目です。自前のエンドポイント・PostHog・GA4 など任意の集計先（sink）に
繋げば、「モードがどれだけ使われたか」「どの説明を何回表示したか」が取れます。

```js
function track(event, props = {}) {
  // どれか1つの sink を選ぶ:
  navigator.sendBeacon?.('/collect', JSON.stringify({ event, ...props, t: Date.now() }));
  // window.posthog?.capture(event, props);
  // window.gtag?.('event', event, props);
}

// onClose には record が渡らないので、滞在時間の計測用に「何を開いたか」を覚えておく。
let openedId = null;
let openedAt = 0;

const help = initHelpLayer({
  config,
  toggle: '#help-toggle',
  onEnable:  () => track('help_mode_on'),
  onDisable: () => track('help_mode_off'),
  onOpen: (record) => {
    openedId = record.key ?? record.title; // key と id の使い分けは下の注記を参照
    openedAt = Date.now();
    track('help_open', { id: openedId, kind: record.kind });
  },
  onClose: () => {
    if (openedId !== null) {
      track('help_close', { id: openedId, dwellMs: Date.now() - openedAt });
      openedId = null;
    }
  },
});
```

| イベント | 作れる指標 |
|---|---|
| `help_mode_on` / `help_mode_off` | 利用率／ヘルプモードに入った回数 |
| `help_open`（`id` 別） | どの項目が・何回見られたか |
| `help_close`（`dwellMs`） | 各説明がどれだけ読まれたか |

> **`record.id` ではなく `record.key` を使うこと。** 要素紐づけの項目では `record.id` は対象**要素そのもの**
> （シリアライズ不可）で、`record.key` が安定した config キー文字列です。キーを持たないインライン定義のみの
> 要素には `record.title` をフォールバックに使います。

> `update()` / `disable()` / `destroy()` がクリーンアップで開いていたポップアップを閉じる際や、開いている
> ポップアップから別のエントリへ切り替えた際（前のエントリ分）にも `onClose` は1回発火するので、上記の
> 滞在時間計測のつじつまは合います。

---

## 2. ディープリンク：`?help=<key>` で起動時に説明を開く

`open(key)` は自動でモードを ON にするため、`?help=save` のような URL で訪問者を特定の説明へ直接
連れて行けます。サポート返信やドキュメントで「**この**ボタンのヘルプを見て」と直リンクするのに便利です。

```js
const help = initHelpLayer({ config, toggle: '#help-toggle' });

const key = new URLSearchParams(location.search).get('help');
if (key && config[key]) {
  // 要素紐づけの項目は、開く前に対象を画面内へスクロールしておく。
  document
    .querySelector(`[data-help-id="${CSS.escape(key)}"]`)
    ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  help.open(key); // OFF なら自動で ON になる
}
```

逆向きに URL を同期させることもできます。`onOpen` で `?help=<key>` を書き、`onClose` で
`history.replaceState` を使って消せば、アドレスバーが常に「今開いている説明」を反映し、そのままコピペで
共有できます。

---

## 3. ヘルプ検索：項目を横断するコマンドパレット

渡した `config` は、全説明の一覧（ディレクトリ）でもあります。これを列挙して入力に応じて絞り込み、選択で
`open(key)` を呼べば、マーカーを探すより検索が速い項目数の多い画面で効きます。

```js
// `config` は initHelpLayer に渡したのと同じオブジェクト。
const entries = Object.entries(config).map(([key, v]) => ({ key, title: v.title }));

searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  const hits = entries.filter(
    (e) => e.key.toLowerCase().includes(q) || e.title.toLowerCase().includes(q),
  );
  resultList.replaceChildren(
    ...hits.map((e) => {
      const li = document.createElement('li');
      li.textContent = e.title;
      li.dataset.key = e.key;
      return li;
    }),
  );
});

resultList.addEventListener('click', (event) => {
  const key = event.target.closest('[data-key]')?.dataset.key;
  if (key) {
    help.open(key); // スクロールしてポップアップを開く。OFF なら自動で ON
  }
});
```

---

## 4. フレームワーク連携：React / Vue でマウント・アンマウント

`initHelpLayer` はハンドルを返し、`destroy()` で完全にクリーンアップできるので、コンポーネントの
ライフサイクルにそのまま対応します。マウントで init、アンマウントで destroy、データ変更時に
`update(config)` を呼びます。

**React** — 小さなフック:

```jsx
import { useEffect, useRef } from 'react';
import { initHelpLayer } from 'help-layer';

export function useHelpLayer(options) {
  const ref = useRef(null);

  useEffect(() => {
    const help = initHelpLayer(options);
    ref.current = help;
    return () => help.destroy(); // アンマウント時に完全クリーンアップ
    // 初期化は一度だけ: `options` は安定させる（render 外で定義 or useMemo）。
  }, []);

  // 再初期化せずに config 変更だけ反映する。
  useEffect(() => {
    ref.current?.update(options.config);
  }, [options.config]);

  return ref;
}
```

**Vue** — `<script setup>`:

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { initHelpLayer } from 'help-layer';

let help;
onMounted(() => {
  help = initHelpLayer({ config, toggle: '#help-toggle' });
});
onUnmounted(() => help?.destroy());
</script>
```

---

## プライバシーについて

レシピ1はクライアントからイベントを発火します。**何をページの外へ出し、どこへ送るかは利用側の責務**です。
ユーザーの同意設定を尊重し、個人を特定できる情報を `config` のキーに入れない（キーはそのまま分析ラベルに
なります）、そしてタブを閉じても最後の `help_close` を落とさないよう `navigator.sendBeacon` を優先してください。
