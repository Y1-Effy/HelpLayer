# セキュリティポリシー

[English](./SECURITY.md) | **日本語**

HelpLayer は小規模な、フレームワーク非依存・完全クライアントサイドのライブラリで、
ベストエフォートで保守しています。本書では脆弱性の報告方法と、それに対する対応方針を説明します。
ライブラリ自体の技術的なセキュリティ姿勢（XSS・CSP・Trusted Types）については
[README のセキュリティ節](./README.ja.md#セキュリティ)を参照してください。

## 脆弱性の報告

**セキュリティ脆弱性については、公開 issue を立てないでください。**

GitHub の非公開脆弱性報告（private vulnerability reporting）を利用してください。

1. リポジトリの **Security** タブ → **Report a vulnerability**
   （<https://github.com/Y1-Effy/HelpLayer/security/advisories/new>）を開きます。
2. 事象・影響を受けるバージョン・可能なら再現手順を記載してください。

数日以内に受領の連絡を行います。個人によるベストエフォート運用のため応答 SLA は保証しませんが、
セキュリティ報告は他の作業より優先して対応します。

## サポート対象バージョン

セキュリティ修正を受けられるのは、**公開済みの最新リリースのみ**です。それ以前のバージョンへの
バックポートは行いませんので、最新バージョンへの更新をお願いします。

## セキュリティリリース方針

- 確認された脆弱性は修正のうえ、新しいパッチリリースとして配布します。
- [GitHub Security Advisory（GHSA）](https://github.com/Y1-Effy/HelpLayer/security/advisories)
  を公開し、必要に応じて CVE を取得します。
- 利用者が対応できるよう、リリースノート／変更履歴に修正内容を明記します。

## 依存パッケージ方針

- **HelpLayer にランタイム依存はありません** — 配布する `dist/` は実行時に何も読み込みません。
  [`@floating-ui/dom`](https://floating-ui.com/) は **devDependency のみ**です（既定ではない代替の
  配置バックエンドの維持と型チェック用）。既定のバックエンドは依存ゼロです。
- [Dependabot](./.github/dependabot.yml) が npm 依存と GitHub Actions を毎週監視し、
  セキュリティ・保守更新をプルリクエストとして提示します。
- CDN から読み込む場合は、バージョンを固定し Subresource Integrity（SRI）を付与してください
  （README 参照）。

## 脅威モデル（要約）

HelpLayer はすべてブラウザ内で動作し、ホストアプリに加える**追加の攻撃面を最小化する**設計です。
（DOM・`<style>`・イベントリスナー・フォーカス制御・`inert` を追加し、`render` は任意の DOM を挿入できる
ため、攻撃面が文字どおりゼロというわけではありません。可能な限り小さく保つことが目標です。）
詳細は [README のセキュリティ節](./README.ja.md#セキュリティ)にありますが、要点は次のとおりです。

- **外部通信なし・ストレージ利用なし。** `fetch` を呼ばず、`localStorage` / `cookie` にも触れません。
- **本文の描画は `textContent` のみ。** `innerHTML` / `eval` / `new Function` を一切使わないため、
  厳格な CSP・Trusted Types にそのまま対応します。
- **唯一、呼び出し側のデータが HTML／DOM ノードになりうる経路は `render` オプション**で、その戻り値は
  サニタイズされません。`render` に渡す未信頼データは呼び出し側で無害化してください。
- **注入する `<style>`** が唯一の CSP 関連アーティファクトです。厳格な `style-src` 下では
  `nonce` オプションでリクエストごとの nonce を渡してください。
- **透明な遮断レイヤー**は、ホストアプリ自身のイベントリスナーに接続・変更することなく操作を吸収し、
  追加した要素は teardown 時にすべて除去されます。
