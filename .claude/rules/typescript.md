---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "tsconfig*.json"
---

# TypeScript 規約

## tsconfig の構成

- `tsconfig.json` は参照のみのソリューション構成で、実体は `tsconfig.app.json`（拡張機能のコード）と `tsconfig.node.json`（`*.config.ts` とテスト）。拡張機能のコードに Node.js の型（`Buffer`、`process` 等）が混入しないよう分けている
- 共通の厳格な設定は `tsconfig.base.json` にあり、WXT が生成する `.wxt/tsconfig.json` を継承する。`.wxt/tsconfig.json` にある項目は重ねて書かない
- `skipLibCheck` は `.wxt/tsconfig.json` の `true` のままにする。`false` にすると WXT の生成物（`.wxt/types/`）と依存パッケージの型定義が TypeScript 7 でエラーになる。`browser.*` の型検査はこの設定でも有効

## JSX

- Babel と `@preact/preset-vite` は使わない。JSX は `tsconfig.base.json` の `jsxImportSource: "preact"` に従って Vite（Oxc）が変換する

## 自動チェック

- 型チェック: `pnpm typecheck`
- lint: `pnpm lint`（Oxlint。prek・CI）
- 整形: `pnpm fmt`（Oxfmt。prek・CI）
