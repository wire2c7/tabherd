# Proposal

## Why

使われない（無効な）ルールは、その入力欄の下にエラーを出すだけで、一覧が長いと画面の外にあって気づけず、設定画面を閉じていると分からない（#72）。#70 で無効なあいだもそのルールのグループを残すようにしたため、名前を空のまま残したルールにも気づける必要がある。

## What Changes

- 設定画面の一覧の上に、使われないルールの件数を表示する
- 使われないルールがあるあいだ、拡張機能のアイコンにバッジ「!」を付け、アイコンの説明に件数を出す

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `rule-settings-ui`: 「使われないルールの通知」を加える

## Impact

- `utils/rules/match.ts`: 使われないルールの件数を数える関数
- `components/rule-settings/rule-settings.tsx`: 一覧の上の件数の表示
- `entrypoints/background/`: 反映のたびにバッジと説明を更新する
