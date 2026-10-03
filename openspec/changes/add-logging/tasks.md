# Tasks

## 1. 依存と判断の記録

- [x] 1.1 `@logtape/logtape` を `minimumReleaseAge` を満たす版で `pnpm add` し、`pnpm install` が `minimumReleaseAge`・`trustPolicy` に通ることを確かめる
- [x] 1.2 LogTape の採用（pino・loglevel・自作・Sentry を採らない理由）と、ログを端末にだけ保存して利用者に書き出してもらう方針を `docs/adr/` に ADR として残す

## 2. ログの保存の仕組み

- [x] 2.1 `utils/logging/` に、保存するログの型・`storage.defineItem` と、LogTape のログを保存する形（`StoredLogEntry`）に変える関数を書き、メッセージの埋め込みと `Error` の変換を単体テストで確かめる
- [x] 2.2 ログを順に追記して直近 500 件に切る sink を書き、追記の順・500 件の上限・保存の失敗で止まらないことを fake-browser の単体テストで確かめる
- [x] 2.3 warning より下を直近 100 件溜め、warning 以上で流して空にするバッファを書き、流す内容・件数の上限・発動の後に元の状態へ戻ることを単体テストで確かめる
- [x] 2.4 `utils/logging/setup.ts` にロガーの設定（カテゴリ、ビルドごとの console のレベル、保存の sink）を書き、debug が保存されず warning で直前のログと一緒に保存されることを単体テストで確かめる

## 3. ログを出す

- [x] 3.1 `entrypoints/background.ts` で起動時にロガーを設定し、捕捉されないエラー（`error`・`unhandledrejection`）とイベントの受け取りをログに出す
- [x] 3.2 `utils/grouping/` の判定・操作の計画・ルールの変更の反映に debug のログを足し、`serial.ts`・`execute.ts` の `console.error` をロガーに置き換える。操作のログから `title`・`color` を落とす関数を書き、グループ名・URL を含む入力で操作が失敗したときのログにそれらが含まれないことを単体テストで確かめる

## 4. オプションページ

- [x] 4.1 書き出すファイルの中身（拡張機能・ブラウザのバージョン、日時、ログ）とファイル名を組み立てる関数を書き、User-Agent からブラウザの版だけを取り出すことを含めて単体テストで確かめる
- [x] 4.2 `components/log-settings/` に「ログ」の節（説明、「ログを保存」・「ログを消去」）を作ってオプションページのルールの一覧の下に置き、説明の表示・書き出し・消去を E2E テスト（`e2e/logging.e2e.ts`）で確かめる

## 5. 消去の競合の解消

- [x] 5.1 端末への書き込みを追記と消去の待ち行列（FIFO）にし、消去の前に受け取ったログが消え、後のログが残ることを単体テストで確かめる。バッファに溜めたログを捨てる口も足し、単体テストで確かめる
- [x] 5.2 オプションページの「ログを消去」を background へのメッセージにし、background が待ち行列に消去を入れる。既存の E2E テスト（書き出しと消去）が通ることを確かめる

## 6. 全体の確認

- [x] 6.1 `pnpm build` した拡張機能の Service Worker で捕捉されないエラーをわざと起こし、エラーと直前のタブの判定のログが保存され、URL・グループ名が含まれないことを E2E テスト（`e2e/logging.e2e.ts`）で確かめる。グループの操作は実際のブラウザでは決まった形で失敗させられないため、操作の失敗のログは単体テスト（`utils/grouping/regroup.test.ts`）で確かめる
- [x] 6.2 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check` が通ることを確かめる
- [x] 6.3 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
