# Proposal

## Why

`local:rules` に保存されたルールの形が壊れていると（例：ルールの `conditions` が `null`）、background のグループ化と、設定画面のルールの一覧の描画が例外で失敗する（#56）。WXT の storage は保存された値の形を確かめずに返し、ルールを読む側も確かめていない。

## What Changes

- 保存されたルールの一覧を読むとき、形を確かめ、扱える形に直す。保存値が配列でなければ空の一覧、`id`・グループ名が読めないルールは除き、読めない条件だけを除き、読めない色は grey にする
- background は直した一覧でグループ化を続け、壊れた値を見つけたら警告のログを残す（同じ状態が続くあいだは1回だけ）
- 設定画面は直した一覧を表示し、ルールの一部が壊れていた旨の警告を出す。自動では書き戻さず、利用者が編集したときに直した一覧で保存する

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `grouping-rules`: 「保存されたルールの読み込み」を加える
- `rule-settings-ui`: 「壊れたルールの表示」を加える

## Impact

- `utils/rules/parse.ts`（新規）: 保存値をルールの一覧に直す関数
- `utils/rules/storage.ts`: 直した一覧を読む・購読する関数
- `utils/rules/reader.ts`（新規）: background が使う、壊れていれば警告のログを残す読み込みと購読
- `entrypoints/background.ts`: ルールの読み込みと購読を `reader.ts` に替える
- `components/rule-settings/use-rules.ts`・`rule-settings.tsx`: 直した一覧の表示と警告
- `e2e/`: 壊れた保存値を書くフィクスチャ（`setStoredRules`）と、background・設定画面の E2E テスト
