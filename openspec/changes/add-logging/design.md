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

そのため、発動のたびにバッファを空にして元の状態に戻るバッファを `utils/logging/` に自前で書く。warning より下のログは直近 100 件をメモリに溜め、warning 以上が来たら、溜めたログとそのログを端末への書き込みへ流してバッファを空にする。

バッファは、受け取った時点でログを保存する形（`StoredLogEntry`。JSON の写し）に変えて溜める。LogTape はログに渡された値を一段しか写さない（`logger.js` の `resolveProperties`）ため、生のログを溜めると、呼び出し側が後で配列・オブジェクトを書き換えたときに、保存する内容が書き換え後の値になる。

- 代替案：ログに渡す値の型を `Readonly<T>` 等にする。型が防ぐのは受け取った側の書き換えだけで、渡した側が自分の参照で書き換えるのは防げない
- 代替案：`Object.freeze` で凍らせる。凍るのは渡した側のオブジェクトそのもので、渡した側の後の書き換えが例外になり、ログを出しただけで本来の処理の動きが変わる
- 保存しない debug のログも1件ごとに JSON に変えることになり、メッセージに埋める値はメッセージとプロパティのために2回 JSON にする。ログに渡すのは ID・件数等の小さい値で、件数も判定・操作の数ほどのため、問題にしない
- 代替案：`fingersCrossed` をそのまま使う。エラーの後の文脈も残るが、上の理由で採らない
- 代替案：`fingersCrossed` の `bufferTtlMs` 等で発動を解除する。解除は `isolateByContext` を使うときだけ効き、時間で区切ることになり、件数の上限を守れない

### 端末への保存

- 保存する値は `storage.defineItem<StoredLogEntry[]>("local:logs")` に置く。1件は `{ timestamp, level, category, message, properties }` の JSON にする
  - `message` は LogTape のメッセージのテンプレートに値を埋めた文字列
  - `properties` の `Error` は `{ name, message, stack, cause, errors }` に変える（`JSON.stringify` では `Error` が `{}` になるため）。`cause` は原因の例外（WXT の storage の `MigrationError` 等が持つ）、`errors` は `AggregateError` がまとめた例外で、入れ子の `Error` も同じ形にする
  - 循環している参照は `"[循環参照]"` に置き換える。`JSON.stringify` が例外を投げると値全体が文字列になり、外側のエラーのスタックトレースまで失うため。同じ値を2か所から参照しているだけなら置き換えない
  - BigInt は10進の文字列にする（`JSON.stringify` が例外を投げ、値全体が文字列になるのを防ぐため）。それでも JSON にできない値（読むと例外を投げるプロパティを持つもの等）は、値全体を文字列にする
- 端末への書き込み（`utils/logging/log-writer.ts`）は、バッファから `StoredLogEntry` を同期で受け取り、次の待ち行列で順に「読む → 末尾に足す → 直近 500 件に切る → 書く」を行う。保存に失敗したら `console.error` に出す（ロガーに出すと自分自身へ戻るため）
- WXT の storage は保存した値の形を確かめずに返すため、壊れていて配列でない値は読む側で見分ける。追記は壊れた値を捨てて足したログだけを保存する（止めると、利用者が消去するまでログを保存できなくなるため）。件数の表示は読み込みの失敗として扱い（「ログを消去」で戻せる）、書き出しは失敗として表示する
- 端末への書き込みは、background の1本の待ち行列（FIFO）で、受け取った順に1つずつ行う。待ち行列の中身は「追記」と「消去」で、追記は、待ち行列の末尾にまだ実行していない追記があればそこへまとめる。消去を挟んだ後のログは、消去より前の追記にまとめない

### 消去

`chrome.storage` には条件付きの書き込みが無く、追記は「読む → 足す → 書く」になる。オプションページが直接 `removeValue` すると、background の追記が読んでから書くまでの間に消去が入ったとき、消したログが書き戻される。

そのため、オプションページは `runtime.sendMessage` で消去を background に依頼し、background が書き込みの待ち行列に消去を入れる。書き込むのが background だけになり、追記と消去が受け取った順に1つずつ処理される。依頼を受けたときは、エラーの直前の文脈としてメモリに溜めたログも捨てる。捨てないと、消去の後の警告で、消去より前のログが保存される。

消去に失敗したら、捨てたメモリのログを溜め直す。メモリのログは、依頼の後に出たログを消さないよう、消し終わるのを待たずに依頼を受けた時点で捨てる。そのため、失敗したときに戻さないと、保存したログは残るのに直前の文脈だけが失われる。消去を待つ間に警告が出て、溜めたログを保存した後は戻さない。戻すと、保存したログより古いログが後から保存され、順序が崩れるため。別の消去の依頼を受けた後も戻さない（オプションページを2つ開いて続けて押した等）。戻すと、後の消去が成功しても、その前のログが残るため

- 代替案：オプションページから直接 `removeValue` し、競合を許容する。消したログが戻っても記録しているのは ID とエラーだけだが、Spec の「すべて消す」に反する
- 代替案：消去した時刻を保存し、追記のときにそれより前のログを捨てる。時刻を読んでから書くまでの間に消去が入ると同じことが起きるため、競合が小さくなるだけで無くならない
- 消去を依頼すると、止まっていた Service Worker が起きる。消去はまれな操作のため、問題にしない

### 記録する情報の範囲

ログを出す側で、ID・件数・処理の種類・エラーだけを渡す。グループの操作（`GroupOperation`）は、操作の種類ごとにログに出すフィールド（`type` と、ID・位置）を決め、そのフィールドだけを写してから渡す（`toLoggedOperation`）。`title`・`color` を除く形にすると、操作の型に後からフィールドが足されたときに、そのままログに出るため。端末への保存の段階では内容を検査しない。検査で URL らしい文字列を取り除いても、グループ名等は見分けられないため。

代わりに、グループ名・URL を含む入力で失敗する操作を実行し、出たログにそれらが含まれないことを単体テストで確かめる。実際のブラウザでは、捕捉されないエラーを起こして保存されたログに URL・グループ名が無いことを E2E テストで確かめる。E2E の fixture は Service Worker の console の error を失敗として扱うため、わざと起こすエラーは `expectedErrors` で除く

### 書き出し

- オプションページの「ログ」の節は `components/log-settings/` に置き、オプションページだけで表示する（ポップアップは狭いため置かない）
- 書き出すファイルは `{ extensionVersion, browser, exportedAt, logs }` の JSON で、名前は `tabherd-logs-<日時>.json` にする。`Blob` と `<a download>` で保存させるため、`downloads` の権限は要らない
  - `extensionVersion` は `browser.runtime.getManifest().version`
  - `browser` は `{ brand, version, source }`。User-Agent Client Hints の `navigator.userAgentData.getHighEntropyValues(["fullVersionList"])` から、意味の無い種類（GREASE）と Chromium を除いた種類を選ぶ（Chromium しかなければ Chromium）。Chrome の User-Agent は簡略化されてバージョンが `141.0.0.0` の形になり、Edge 等も `Chrome/` を含むため、User-Agent だけでは正確なバージョンと種類が分からない
  - User-Agent Client Hints が使えない（API が無い、失敗する、一覧が無い・選べない）ときは、`navigator.userAgent` の `Chrome/<版>` の部分を Chromium のバージョンとして入れ、`source` を `userAgent` にする。User-Agent の全体は OS も含むため入れない。TypeScript の DOM の型定義に `userAgentData` が無いため、使う部分の型を自分で定める
- 書き出す前に、`runtime.sendMessage` で background に保存の待ちを依頼し、待ち行列の保存が終わってから読む。警告の直後に書き出すと、保存の途中のログ（警告そのものを含む）がファイルから漏れるため。待ちの依頼が失敗しても、保存済みのログは書き出せるため、`console.warn` に出して書き出しを続ける
- ファイルの中身は純粋関数で組み立て、単体テストで確かめる

### 捕捉されないエラー

background の起動時に、Service Worker の `error`・`unhandledrejection` を購読し、`["tabherd", "background"]` に error で出す。リスナーは Service Worker の最初の評価の中で登録する。

Chrome は `chrome.*` のイベント（`tabs.onUpdated`・`storage.onChanged` 等）のリスナーが同期的に投げた例外を自分で受け取るため、`error` イベントに届かない（E2E で、リスナーが呼ばれて例外を投げても `error` イベントが発火しないことを確かめた。`setTimeout` の中で投げた例外と、リスナーの中の Promise の拒否は届く）。そのため、background のリスナーは `utils/logging/listener.ts` の `logListenerErrors` で包み、例外をログに残してから投げ直す。投げ直すのは、Chrome での例外の扱いを変えないため。ルールの変更の監視は、処理を `debounceChanges` が `setTimeout` の中で呼び、例外が `error` イベントに届くため包まない。

## Risks / Trade-offs

- [ログを出す側が誤って URL・グループ名を渡す] → 失敗する操作のログのテストで確かめる。ログに渡す値は、型（`GroupOperation` から作る関数）で `title` を落とす
- [Chrome のエラーのメッセージに想定外の情報が入る] → 今の API の失敗のメッセージは ID だけを含む（例：`No group with id: 1560791577.`）。ほかの形が見つかったら、ログに渡す前に取り除く
- [バッファが Service Worker の停止で消える] → エラーより前に止まった場合は、直前のログが残らない。エラーは同じイベントの処理の中で起きるため、直前の判定のログはバッファに残っている
- [複数のウィンドウを同時に処理すると、ほかのウィンドウのログがバッファを埋め、失敗したタブの判定を始めたログが押し出される] → バッファは全体で1つで、`regroupAllWindows` 等はウィンドウを `Promise.all` で同時に処理する。件数を 100 件にして起こりにくくし、失敗のログ自体に操作の種類とタブ・グループの ID を入れて、判定のログが無くても対象が分かるようにする。ウィンドウごとにバッファを分けるには、ログにウィンドウを表す値を必ず入れる必要があり、今は行わない
- [保存が頻繁になる] → 保存は warning 以上のときだけ。失敗が続く場合も、1回の保存は直近 100 件と警告の分にとどまる
