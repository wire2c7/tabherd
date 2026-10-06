# Tasks

## 1. 規約の追記と ADR

- [x] 1.1 `.claude/rules/typescript.md` に TSDoc の構造化タグ（`@param`・`@returns`・`@remarks` 等）の使用規約と、テストの `it`/`test` 単位で前提条件・事前条件・検証項目を書く規約を追記し、記述内容が Issue #78 の決定事項と一致していることを確認する
- [x] 1.2 規約の採用を `docs/adr/` に ADR として追加し、関連 Issue（#78）を記載する

## 2. utils/ への TSDoc 付与

- [x] 2.1 `utils/grouping/` 配下のエクスポートされた型・関数に構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する
- [x] 2.2 `utils/logging/` 配下のエクスポートされた型・関数に構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する
- [x] 2.3 `utils/rules/`・`utils/storage/` 配下のエクスポートされた型・関数に構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する

## 3. components/ への TSDoc 付与

- [x] 3.1 `components/log-settings/` 配下のエクスポートされた型・関数・コンポーネントに構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する
- [x] 3.2 `components/rule-settings/` 配下のエクスポートされた型・関数・コンポーネントに構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する

## 4. entrypoints/ への TSDoc 付与

- [x] 4.1 `entrypoints/background/` 配下のエクスポートされた関数に構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する
- [x] 4.2 `entrypoints/platform/`・`entrypoints/options/`・`entrypoints/popup/` 配下のエクスポートされた関数に構造化 TSDoc タグを付与し、`pnpm typecheck` が通ることを確認する

## 5. テストへの前提・検証コメント付与

- [x] 5.1 `utils/` 配下の全テストファイルの各 `it`/`test` に前提条件・事前条件・検証項目のコメントを付与し、`pnpm test -- utils` が通ることを確認する
- [x] 5.2 `components/`・`entrypoints/` 配下の全テストファイルの各 `it`/`test` に前提条件・事前条件・検証項目のコメントを付与し、`pnpm test -- components entrypoints` が通ることを確認する

## 6. 全体検証

- [x] 6.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix flake check` が通ることを確認する
