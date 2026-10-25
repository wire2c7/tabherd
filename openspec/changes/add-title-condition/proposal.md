# Proposal

## Why

ルールの条件は URL のみを対象にしており、同じドメイン内でページごとに内容が異なるタブ（検索結果ページをキーワードで分けたい等）を区別してグループ分けできない（Issue #98）。

## What Changes

- 条件に対象（URL・タイトル）を追加し、部分一致・正規表現のそれぞれをタイトルに対しても判定できるようにする
- 既存の保存済み条件（対象の指定がないもの）は URL 条件として扱う（後方互換）
- タブのタイトルが変わったときも、デバウンスを挟んだ上でルールの再判定を行う
- 設定画面（ポップアップ・オプションページ）で、条件ごとに対象（URL・タイトル）を選べるようにする

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `grouping-rules`: 条件が対象（URL・タイトル）を持つようになり、部分一致・正規表現の判定をタイトルに対しても行えるようにする
- `auto-grouping`: タブのタイトルが変わったときも、デバウンスを挟んでタブの判定とグループ化をし直す
- `rule-settings-ui`: 条件の対象（URL・タイトル）を追加・編集できるようにする

## Impact

- `utils/rules/types.ts`: `Condition` の型にタイトル対象を表すフィールドを追加
- `utils/rules/match.ts`: `matchesCondition`・`matchesRule`・`findMatchingRule` がタブのタイトルも受け取り、対象に応じて判定する
- `entrypoints/background/grouping.ts`: `browser.tabs.onUpdated` で `changeInfo.title` もタブ単位でデバウンスして再判定のトリガーにする
- `utils/grouping/debounce.ts`: 既存の `debounceChanges` をタブ単位（タブごとに別インスタンス）で使う
- ルール設定画面のコンポーネント（条件の編集 UI）
