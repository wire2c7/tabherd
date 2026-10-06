# Tasks

## 1. 判断の記録

- [x] 1.1 WXT・Preact・LogTape を使うコードをディレクトリに閉じ込める方針（インターフェースと実装の置き場所、LogTape を使う箇所、import の制限の方法、自動インポートの無効化）を `docs/adr/` に ADR として残す

## 2. LogTape

- [x] 2.1 `utils/logging/logger.ts` に `Logger`・`LogLevel`・`LogEvent`・`compareLogLevel` を置き、`setup.ts` 以外の `utils/` のコードが LogTape を import しないようにする

## 3. ストレージ

- [x] 3.1 `utils/storage/item.ts` に `StorageItem`・`StorageItemDefinition` を置き、`entrypoints/platform/storage.ts` に WXT による実装を置く
- [x] 3.2 `utils/rules/storage.ts`・`reader.ts` が `StorageItem` を受け取るようにし、`watchRules`・`watchRuleChanges` を `RulesStore` の `watch` にまとめる
- [x] 3.3 `utils/logging/storage.ts`・`log-writer.ts`・`setup.ts` が `StorageItem` を受け取るようにする
- [x] 3.4 `components/rule-settings/`・`components/log-settings/` が、ストレージとメッセージの送信、拡張機能のバージョンを props で受け取るようにする

## 4. タブ・タブグループ

- [x] 4.1 `utils/grouping/tabs.ts` に `TabsApi` を置き、`entrypoints/platform/tabs.ts` に WXT による実装を置く
- [x] 4.2 `utils/grouping/snapshot.ts`・`execute.ts`・`regroup.ts` が `TabsApi` を受け取るようにする
- [x] 4.3 依存の増えた `entrypoints/background.ts` を `entrypoints/background/` の `index.ts`・`logs.ts`・`grouping.ts` に分ける

## 5. 検査

- [x] 5.1 `wxt.config.ts` に `imports: false` を書く
- [x] 5.2 `.oxlintrc.jsonc` に、ディレクトリごとの `no-restricted-imports` を書き、違反する import を検出することを確かめる

## 6. ドキュメントと全体の確認

- [x] 6.1 `AGENTS.md` のアーキテクチャと規約に、ディレクトリごとに使えるパッケージを書く
- [x] 6.2 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check` が通ることを確かめる
- [x] 6.3 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
