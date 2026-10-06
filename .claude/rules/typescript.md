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

## import

- import は相対パスで書く。WXT が `.wxt/tsconfig.json` に定義するパスのエイリアス（`@`・`~`）は使わない（`docs/adr/0012-no-path-aliases.md`。`pnpm lint` の `eslint/no-restricted-imports` で検出される）

## JSX

- Babel と `@preact/preset-vite` は使わない。JSX は `tsconfig.base.json` の `jsxImportSource: "preact"` に従って Vite（Oxc）が変換する

## lint（Oxlint）

- 設定は `.oxlintrc.jsonc`。カテゴリ単位で有効にし、合わないルールだけを理由のコメント付きで無効にしている（方針は `docs/adr/0010-strict-oxlint-rules.md`）
- 違反はコードを直して解消する。どうしても無効化コメント（`// oxlint-disable-next-line <ルール名>`）を使う場合は、ルール名を指定して理由を併記する。不要になった無効化コメントはエラーになる
- 型情報を使うルールは `.wxt/tsconfig.json` を読むため、`pnpm install`（postinstall の `wxt prepare`）の後でないと動かない

## TSDoc

- `utils/`・`components/`・`entrypoints/` のエクスポートされた型・関数・コンポーネントには TSDoc を付与する。自由形式の説明文だけでなく、`@param`・`@returns`・`@remarks` 等の構造化タグを使う（`docs/adr/0024-structured-tsdoc-and-test-comments.md`）
- 説明文は日本語で書く。タグ名自体（`@param` 等）は英語のまま使う
- 引数・返り値がある場合は `@param`・`@returns` を省略しない。前提・制約・副作用等、シグネチャから読み取れない注意点は `@remarks` に書く

## テスト

- テストの中の後片付け（購読の解除、ロガーの設定の復元等）は `onTestFinished` で登録する。`vi.spyOn` のモックは設定（`vitest.config.ts`）で戻るため、自分では戻さない。偽のタイマーは `utils/testing/mocks.ts` の `useFakeTimersInTest` で使う。`it.extend` は使わない（理由は `docs/adr/0018-test-cleanup-with-on-test-finished.md`）
- 各テストファイルの `it`/`test` には、その単位での前提条件・事前条件・検証項目をコメントで書く。`describe` 単位でまとめない（`docs/adr/0024-structured-tsdoc-and-test-comments.md`）

## 自動チェック

- 型チェック: `pnpm typecheck`
- lint: `pnpm lint`（Oxlint。prek・CI）
- 整形: `pnpm fmt`（Oxfmt。prek・CI）
