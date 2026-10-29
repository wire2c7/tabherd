# Proposal

## Why

拡張機能をインストールした直後はルールが1つも無く、ユーザーは自分でルールを作るまで自動グルーピングの効果を体験できない（#108）。

## What Changes

- 初回インストール時（`browser.runtime.onInstalled` の `reason === "install"`）にだけ、サンプルルールを3件投入する
  1. `⚙設定` — URL 部分一致 `chrome://`
  2. `📺️動画` — URL 部分一致 `youtube.com` / `nicovideo.jp` / `netflix.com` / `twitch.tv`（OR条件）
  3. `📃ブログ` — タイトル部分一致 `ブログ` / URL 部分一致 `blog`（OR条件）
- サンプルルールの色は、既存の「未使用の色を割り当てる」ロジック（`pickNewRuleColor`）で登録順に自動的に決める
- アップデート時や、既にルールが1件以上保存されている状態では投入しない（一度きりの初期化）

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `grouping-rules`: 「ルールの保存」要件のうち、初回インストール時の挙動を「空の一覧」から「サンプルルール3件が投入された状態」に変更する

## Impact

- `entrypoints/background/rules.ts`: ルールの書き込み用ストアを公開し、初回インストール時にサンプルルールを書き込む処理を追加する
- `entrypoints/background/grouping.ts`: `onInstalled` ハンドラで `reason === "install"` かつルールが空のときにサンプルルールを投入してから `regroupAll` を実行するようにする
- `utils/rules/` 配下にサンプルルールの定義を追加する
- `openspec/specs/grouping-rules/spec.md`: 「初回インストール時」のシナリオを更新する
- 新しい ADR を追加する（設計判断の記録）
