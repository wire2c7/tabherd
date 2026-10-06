# Tasks

## 1. サスペンド対象の絞り込みロジック（utils/suspend/）

- [ ] 1.1 `utils/suspend/tabs.ts` に `SuspendTabsApi`（`queryWindowGroups`・`discardTabs` 等、design.md の決定に沿った最小のインターフェース）と、対象タブ・グループを表す型を定義し、`pnpm typecheck` が通ることで確認する
- [ ] 1.2 `utils/suspend/plan.ts`（仮）に、グループとそのタブ一覧からサスペンド対象（アクティブタブ・ピン留めタブを除外）を絞り込む純粋関数を実装し、Vitest の単体テストで次を確認する: アクティブタブが除外される、ピン留めタブが除外される、対象0件のとき空配列を返す
- [ ] 1.3 `utils/suspend/settings.ts` に、確認表示設定の `StorageItemDefinition<boolean>`（キーは既存の命名規則に合わせる、fallback は `true`）と、valibot の `boolean()` スキーマで検証する読み書き関数を実装し、Vitest で「保存値が真偽値でなければ `true` を返す」ことを確認する

## 2. ブラウザAPIの実装（entrypoints/platform/）

- [ ] 2.1 `entrypoints/platform/tabs.ts`（または新規ファイル）に `SuspendTabsApi` の実装を追加する。`queryWindowGroups` は `browser.windows.getCurrent()` で得たウィンドウIDの `tabGroups.query`・`tabs.query` を呼び、`discardTabs` は `browser.tabs.discard` を呼ぶ。WXT の `fakeBrowser` を使った Vitest で、対象ウィンドウのタブ・グループだけを返すことを確認する
- [ ] 2.2 `entrypoints/platform/storage.ts` の `defineStorageItem` を使って確認表示設定の `StorageItem<boolean>` を組み立てられることを、既存の `defineStorageItem` のテストと同様の Vitest で確認する

## 3. popup のグループ一覧・サスペンド操作（components/suspend-groups/）

- [ ] 3.1 `components/suspend-groups/` に、グループ一覧（グループ名・色・タブ数）を表示するコンポーネントを実装し、`utils/suspend/plan.ts` の絞り込み結果を使ってサスペンド対象のタブ数を算出する。Vitest（Preact のテスト用ユーティリティ）で、手動作成グループを含むグループ一覧が表示されることを確認する
- [ ] 3.2 サスペンドボタンの押下時に、確認表示設定が有効なら `window.confirm()` を呼び、中止されたら `discardTabs` を呼ばないことを実装し、Vitest で「設定が無効なら確認せずに実行される」「確認で中止すると `discardTabs` が呼ばれない」ことを確認する
- [ ] 3.3 `entrypoints/popup/app.tsx` に `SuspendGroups`（仮）を組み込み、`pnpm dev` で起動した拡張機能の popup を開いて、タブグループの一覧とサスペンドボタンが表示されることを目視で確認する

## 4. options の確認表示設定（components/suspend-settings/）

- [ ] 4.1 `components/suspend-settings/` に、`log-settings` と同じ構成で「サスペンド前に確認する」チェックボックスのコンポーネントを実装し、Vitest で初期状態がON、トグルで設定が保存されることを確認する
- [ ] 4.2 `entrypoints/options/app.tsx` に `SuspendSettings`（仮）を組み込み、`pnpm dev` で起動した拡張機能の options 画面でチェックボックスの表示・切り替えが機能することを目視で確認する

## 5. 仕上げ

- [ ] 5.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`pnpm fmt:check` がすべて通ることを確認する
- [ ] 5.2 `nix flake check` と `prek run --all-files` が通ることを確認する
- [ ] 5.3 design.md の決定（`TabsApi` を拡張せず新しいインターフェースを分けたこと）を `docs/adr/` に ADR として記録し、`openspec validate suspend-tab-groups --strict` が通ることを確認する
