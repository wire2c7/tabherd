# Proposal

## Why

ログは `console.error` の2か所だけで、開発中に処理の流れを追えず、リリース後は利用者の手元の Service Worker の console に出たエラーが消えて調査できない。外部のサービスへは送らずに、エラーの前後の記録を端末に残し、利用者が書き出して不具合の報告に添付できるようにする（#52）。

## What Changes

- LogTape を dependencies に加え、background のログをカテゴリ・レベル付きで出す。開発ビルドでは debug 以上、リリース版では warning 以上を console に出す
- debug・info をメモリに溜めておき、warning 以上が出たときに直前のログと一緒に `chrome.storage.local` に保存する。保存は直近 500 件まで
- タブ・グループの判定と操作、ルールの変更の反映、background の捕捉されないエラーをログに残す。ログには ID・件数・処理の種類・エラーだけを入れ、URL・タイトル・グループ名・ルールの内容は入れない
- 既存の `console.error`（`utils/grouping/serial.ts`・`utils/grouping/execute.ts`）をロガーに置き換える
- オプションページに「ログ」の節を置き、記録するもの・しないものの説明と、「ログを保存」（JSON ファイル）・「ログを消去」のボタンを置く
- LogTape の採用とログの保存方針を ADR に残す

## Capabilities

### New Capabilities

- `diagnostic-logging`: 不具合の調査のためのログの記録・端末への保存・利用者による書き出しと消去、記録する情報の範囲

### Modified Capabilities

なし（オプションページへの節の追加は `diagnostic-logging` で定める。`rule-settings-ui` のルールの設定画面の要件は変わらない）

## Impact

- `package.json`・`pnpm-lock.yaml`: dependencies に `@logtape/logtape` を追加する
- `utils/logging/`（新規）: ロガーの設定、端末に保存する sink、保存したログの読み書き
- `entrypoints/background.ts`: ロガーの設定、捕捉されないエラーの記録、イベントのログ
- `utils/grouping/`: 判定・操作のログ、`console.error` の置き換え
- `entrypoints/options/`・`components/`: ログの節
- `background.js` が minify 後で約 36 KB 増える
- `docs/adr/`: LogTape の採用とログの保存方針についての ADR
