# Proposal

## Why

タブグループ単位でタブをまとめてサスペンド（`chrome.tabs.discard` によるメモリ解放）したいという要望がある（#77）。現状、TabHerd にはタブを個別・グループ単位でサスペンドする機能が無く、popup にはタブグループの一覧を表示するUIも無い。

## What Changes

- popup に、開いているウィンドウのタブグループ一覧（グループ名・色・タブ数）と、グループごとの「サスペンド」ボタンを追加する
- サスペンド対象は、操作したウィンドウ内の、そのグループに属するタブのうち、アクティブタブとピン留めタブを除いたもの
- 対象グループは `chrome.tabGroups` に存在する全グループとし、TabHerd のルールで作られたグループかどうかは問わない（ユーザーが手動作成したグループも対象）
- 実行前に `window.confirm()` で確認ダイアログを表示する
- options 画面に新しい独立セクションを追加し、「サスペンド前に確認する」設定（デフォルト ON）を切り替えられるようにする

## Capabilities

### New Capabilities

- `tab-group-suspension`: タブグループ単位での手動サスペンド（対象の絞り込み、popup のグループ一覧・操作、確認ダイアログのON/OFF設定）を扱う

### Modified Capabilities

(なし。既存の自動グルーピング・ルール管理の挙動は変えない)

## Impact

- `entrypoints/platform/tabs.ts`: `discard` 操作と、タブグループ一覧取得の実装を追加
- `entrypoints/popup/app.tsx`: グループ一覧・サスペンド操作のUIを追加
- `entrypoints/options/app.tsx`: 新しい設定セクションを追加
- `components/`: popup 用の新規コンポーネントと、options 用の新規設定コンポーネントを追加
- `utils/`: サスペンド対象の絞り込み（純粋ロジック）と、設定値の StorageItem 定義を追加
- `wxt.config.ts` の `manifest.permissions`: 変更不要（既存の `"tabs"` 権限で `chrome.tabs.discard` を呼べる）
