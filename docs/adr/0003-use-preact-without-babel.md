# 0003. UI に Preact を採用し、JSX を Babel なしで変換する

- ステータス：Accepted
- 日付：2026-09-28

## コンテキスト

UI は設定画面（ルールの編集など）が中心で、大規模な画面は想定していない。拡張機能のサイズは小さいほうがよい。

Preact を Vite で使う一般的な方法は `@preact/preset-vite` だが、これは Babel（`@babel/core` 7 系）を peer dependency として要求する。

## 検討した選択肢

- **`@preact/preset-vite` を使う**：Preact 公式のホットリロード（Prefresh）と DevTools との連携が使える。代わりに Babel とその依存一式が入る
- **Vite（Oxc）の JSX 変換を使う**：Vite 8 は JSX を Oxc で変換でき、tsconfig の `jsxImportSource` に従う。追加の依存が要らない。ホットリロードは変更時のページの再読み込みになる

## 決定

UI には Preact を使い、JSX は Babel と `@preact/preset-vite` を使わず、Vite（Oxc）で変換する。`tsconfig.base.json` の `jsx: "react-jsx"` と `jsxImportSource: "preact"` に従って変換される。

## 結果

- Babel とその依存一式を入れずに済み、依存が少なくなる
- 設定画面は、変更のたびにページ全体が再読み込みされる。画面が小さいため影響はほぼない
- 実装が大きくなり、状態を保ったままのホットリロードが必要になったら、`@preact/preset-vite` の導入を再検討する
