# Proposal

## Why

WXT・Preact・LogTape をいつでも置き換えられるよう、それぞれを使うコードを決まったディレクトリに閉じ込めたい（#63）。今は `utils/` の 5 ファイルと `components/` の 2 ファイルが WXT の `browser`・`storage` を直接使い、LogTape の型も `utils/` の各所で使っている。これを検査する仕組みは無く、WXT の自動インポートにより import を書かずに WXT の API を使えてしまう。

## What Changes

- `utils/` が使うブラウザの API（タブ・タブグループ、ストレージ）を `utils/` のインターフェースにし、WXT による実装を `entrypoints/platform/` に置いて、エントリポイントから渡す
- `components/` は WXT による実装を props で受け取る
- `utils/` は自前の `Logger`・`LogLevel` の型を使い、LogTape を使うのを `utils/logging/setup.ts` だけにする
- WXT の自動インポートを無効にする
- Oxlint の `no-restricted-imports` で、ディレクトリごとに import できるパッケージとディレクトリを制限する

## Capabilities

### New Capabilities

なし（内部の構成の変更で、拡張機能の振る舞いは変わらない）

### Modified Capabilities

なし

## Impact

- `utils/storage/item.ts`（新規）: ストレージの値のインターフェースと定義の型
- `utils/grouping/tabs.ts`（新規）: タブ・タブグループの API のインターフェース
- `utils/logging/logger.ts`（新規）: `Logger`・`LogLevel`・`LogEvent` の型と `compareLogLevel`
- `utils/grouping/`・`utils/rules/`・`utils/logging/`: WXT・LogTape を直接使わず、上のインターフェースを引数で受け取る
- `entrypoints/platform/`（新規）: WXT によるストレージとタブの API の実装
- `entrypoints/`・`components/`: 実装を作って props で渡す・受け取る
- `wxt.config.ts`: `imports: false`
- `.oxlintrc.jsonc`: ディレクトリごとの `no-restricted-imports`
- `docs/adr/`: 依存を閉じ込める方針の ADR
- `AGENTS.md`: アーキテクチャと規約
