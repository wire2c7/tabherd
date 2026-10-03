# Design

## Context

- ログは background の Service Worker で出す。Service Worker は30秒操作が無いと止まり、次のイベントで起き直す。メモリに溜めたログは、止まると消える
- 端末への保存は `chrome.storage.local` を使う（`storage` の権限は既にある）。ルールは WXT の `storage.defineItem`（`utils/rules/storage.ts`）で読み書きしている
- 依存は pnpm の `minimumReleaseAge`・`trustPolicy` で審査している（ADR 0006）
- LogTape（`@logtape/logtape`）は依存が無く、`configureSync`・`getConsoleSink`・`withFilter` と、`(record: LogRecord) => void` の形の sink で組み立てられる

## Goals / Non-Goals

**Goals:**

- background のログを、カテゴリ・レベル付きの1つの仕組みで console と端末の両方へ出す
- 端末に保存するログに、閲覧先が分かる情報が入らないことをテストで確かめる

**Non-Goals:**

- ポップアップ・オプションページの UI のログの保存。UI のエラー（`components/rule-settings/use-rules.ts` の `console.error`）は console のままにする。UI と background が同じストレージの値を読み書きすると、追記どうしが競合するため
- ログの外部への送信
- 利用者がログの記録を止める設定

## Decisions

### ロガーの構成

- カテゴリは `["tabherd", <領域>]`（`background`・`grouping`）にする。LogTape 自身のログ（`["logtape", "meta"]`）は warning 以上を console にだけ出す
- 設定は `utils/logging/setup.ts` の関数にまとめ、background の起動時に `configureSync` で同期的に設定する。非同期の `configure` だと、設定が終わる前に来たイベントのログが捨てられるため
- 開発ビルドかどうかは `import.meta.env.DEV` で見分ける。console へは開発ビルドで debug 以上、リリース版で warning 以上を出す（`withFilter`）。端末に保存する sink は、どちらのビルドでも debug 以上を受け取る

### エラーの前後のログの保存（バッファ）

LogTape の `fingersCrossed` は、一度発動すると、それ以降のログを Service Worker が止まるまですべて下流へ流す（`sink.js` の `triggered` が戻らない）。これを端末への保存に使うと、エラーの後に操作が続いたとき、debug のログが保存の上限の 500 件を埋めて、エラー本体を押し出してしまう。

そのため、発動のたびにバッファを空にして元の状態に戻るバッファを `utils/logging/` に自前で書く。warning より下のログは直近 100 件をメモリに溜め、warning 以上が来たら、溜めたログとそのログを下流の sink へ流してバッファを空にする。

- 代替案：`fingersCrossed` をそのまま使う。エラーの後の文脈も残るが、上の理由で採らない
- 代替案：`fingersCrossed` の `bufferTtlMs` 等で発動を解除する。解除は `isolateByContext` を使うときだけ効き、時間で区切ることになり、件数の上限を守れない

### 端末への保存

- 保存する値は `storage.defineItem<StoredLogEntry[]>("local:logs")` に置く。1件は `{ timestamp, level, category, message, properties }` の JSON にする
  - `message` は LogTape のメッセージのテンプレートに値を埋めた文字列
  - `properties` の `Error` は `{ name, message, stack }` に変える（`JSON.stringify` では `Error` が `{}` になるため）
- sink は同期で呼ばれるため、受け取ったログをその場で `StoredLogEntry` に変えて溜め、Promise の連鎖で順に「読む → 末尾に足す → 直近 500 件に切る → 書く」を行う。保存に失敗したら `console.error` に出す（ロガーに出すと自分自身へ戻るため）
- 消去はオプションページから `removeValue` で行う。background の追記と同時に起きると、追記が消去の前の値を読んで書き戻すことがある。消去はまれな操作のため、許容する

### 記録する情報の範囲

ログを出す側で、ID・件数・処理の種類・エラーだけを渡す。グループの操作（`GroupOperation`）は、`title`・`color` を除いた `{ type, groupId, windowId, tabIds, index }` の形にしてから渡す。端末に保存する sink では内容を検査しない。検査で URL らしい文字列を取り除いても、グループ名等は見分けられないため。

代わりに、グループ名・URL を含む入力で失敗する操作を実行し、出たログにそれらが含まれないことを単体テストで確かめる。実際のブラウザでは、捕捉されないエラーを起こして保存されたログに URL・グループ名が無いことを E2E テストで確かめる。E2E の fixture は Service Worker の console の error を失敗として扱うため、わざと起こすエラーは `expectedErrors` で除く

### 書き出し

- オプションページの「ログ」の節は `components/log-settings/` に置き、オプションページだけで表示する（ポップアップは狭いため置かない）
- 書き出すファイルは `{ extensionVersion, browserVersion, exportedAt, logs }` の JSON で、名前は `tabherd-logs-<日時>.json` にする。`Blob` と `<a download>` で保存させるため、`downloads` の権限は要らない
  - `extensionVersion` は `browser.runtime.getManifest().version`
  - `browserVersion` は `navigator.userAgent` の `Chrome/<版>` の部分。User-Agent の全体は OS も含むため入れない
- ファイルの中身は純粋関数で組み立て、単体テストで確かめる

### 捕捉されないエラー

background の起動時に、Service Worker の `error`・`unhandledrejection` を購読し、`["tabherd", "background"]` に error で出す。リスナーは Service Worker の最初の評価の中で登録する。

## Risks / Trade-offs

- [ログを出す側が誤って URL・グループ名を渡す] → 失敗する操作のログのテストで確かめる。ログに渡す値は、型（`GroupOperation` から作る関数）で `title` を落とす
- [Chrome のエラーのメッセージに想定外の情報が入る] → 今の API の失敗のメッセージは ID だけを含む（例：`No group with id: 1560791577.`）。ほかの形が見つかったら、ログに渡す前に取り除く
- [バッファが Service Worker の停止で消える] → エラーより前に止まった場合は、直前のログが残らない。エラーは同じイベントの処理の中で起きるため、直前の判定のログはバッファに残っている
- [複数のウィンドウを同時に処理すると、ほかのウィンドウのログがバッファを埋め、失敗したタブの判定を始めたログが押し出される] → バッファは全体で1つで、`regroupAllWindows` 等はウィンドウを `Promise.all` で同時に処理する。件数を 100 件にして起こりにくくし、失敗のログ自体に操作の種類とタブ・グループの ID を入れて、判定のログが無くても対象が分かるようにする。ウィンドウごとにバッファを分けるには、ログにウィンドウを表す値を必ず入れる必要があり、今は行わない
- [保存が頻繁になる] → 保存は warning 以上のときだけ。失敗が続く場合も、1回の保存は直近 100 件と警告の分にとどまる
