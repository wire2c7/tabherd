# 0004. TypeScript 7 と厳格な tsconfig を採用する

- ステータス：Accepted
- 日付：2026-09-28

## コンテキスト

TypeScript は、Go で書き直された 7.x（`typescript` 7.0.2）を使う。型チェックの設定は「できるだけ厳格に」することを方針とした。

WXT は `wxt prepare` で `.wxt/tsconfig.json` を生成し、`strict`・`noUncheckedIndexedAccess`・`noImplicitOverride`・`verbatimModuleSyntax` などを有効にしている。

## 検討した選択肢

### 追加する厳格化の項目

WXT の設定に加えて、`exactOptionalPropertyTypes`・`noPropertyAccessFromIndexSignature`・`noImplicitReturns`・`noUnusedLocals`・`noUnusedParameters`・`allowUnreachableCode: false`・`allowUnusedLabels: false`・`erasableSyntaxOnly`・`noUncheckedSideEffectImports`・`isolatedModules` を有効にする。

### `skipLibCheck`

- **`false`（型定義ファイルも検査する）**：WXT の生成物（`.wxt/types/`）と依存パッケージの型定義が TypeScript 7 でエラーになる。例えば、`@aklinker1/rollup-plugin-visualizer` が `rollup` の型を参照している（Vite 8 は Rolldown を使うため `rollup` が入らない）。いずれも自分たちでは直せない
- **`true`（WXT の既定値）**：型定義ファイルの中身は検査しない。`browser.tabs`・`browser.tabGroups` の型チェックが効くこと（存在しない色の指定などがエラーになること）は確認した

### tsconfig の分け方

- **1つにまとめる**：Vitest・Vite の型が `@types/node` を読み込むため、拡張機能のコードでも `Buffer` や `process` などの Node.js の型が使えてしまう
- **拡張機能のコードと Node で動くコードに分ける**：create-vite と同じ構成。拡張機能のコードに Node.js の型が入らない

## 決定

- 上記の厳格化の項目を `tsconfig.base.json` に書き、`.wxt/tsconfig.json` を継承する
- `skipLibCheck` は `true` のままにする
- `tsconfig.json` は参照だけの構成にし、`tsconfig.app.json`（`entrypoints/`）と `tsconfig.node.json`（`*.config.ts` とテスト、`types: ["node"]`）に分ける。型チェックは `tsc -b` で行う

## 結果

- 拡張機能のコードで Node.js の API を誤って使うと、型エラーになる
- 型定義ファイルの誤りは検出できない
- `.wxt/tsconfig.json` は `pnpm install`（postinstall の `wxt prepare`）で生成されるため、それより前は型チェックができない
- WXT や依存パッケージの型定義が TypeScript 7 に対応したら、`skipLibCheck: false` を再検討できる
