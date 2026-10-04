# Design

## Context

- WXT を直接使うのは `utils/grouping/execute.ts`・`snapshot.ts`（`browser.tabs`・`browser.tabGroups`）、`utils/rules/storage.ts`・`reader.ts`・`utils/logging/storage.ts`（`storage.defineItem`）、`components/log-settings/log-settings.tsx`（`browser.runtime`）。`components/log-settings/count.ts` は `utils/logging/storage.ts` が export する WXT の storage item の `watch` を呼ぶ
- LogTape を直接使うのは `utils/logging/` の `setup.ts`・`buffer.ts`・`entry.ts`・`storage.ts`・`listener.ts` と `utils/rules/reader.ts`。拡張機能のコードがロガーに使うのは `debug`・`info`・`warn`・`error` だけ
- WXT の自動インポートが有効で、`.wxt/types/imports.d.ts` が `browser`・`storage` 等をグローバルに宣言している。今は import を書かずに使っている箇所は無い
- WXT は `entrypoints/` の直下のファイルと `entrypoints/<名前>/index.*` だけをエントリポイントとして扱う（`wxt` の `find-entrypoints.mjs` の `PATH_GLOB_TO_TYPE_MAP`）。`entrypoints/<名前>/` の `index` 以外のファイルはエントリポイントにならない（`entrypoints/popup/app.tsx` と同じ）
- Oxlint の `no-restricted-imports` の `regex` は先読み（`(?!…)`）を使うと何も検出しない（エラーも出ない）。gitignore 形式の `group` は `!` での除外と、除外の後の再指定が効く（どちらも Oxlint 1.85.0 で確かめた）

## Goals / Non-Goals

**Goals:**

- WXT を使うのを `entrypoints/`、Preact を使うのを `components/` と `entrypoints/` に限る
- `utils/` が使う外部パッケージを `valibot` と、`utils/logging/setup.ts` の LogTape に限る（テスト・テスト用ヘルパーは除く）
- 上の制限を `pnpm lint` で検査する

**Non-Goals:**

- WXT・Preact・LogTape を実際に置き換えること
- 拡張機能の振る舞いを変えること（コードレビューで見つかった不具合の修正も含めない）

## Decisions

### ブラウザの API はインターフェースを `utils/` に置き、WXT による実装を `entrypoints/platform/` に置く

`utils/` は使う API をインターフェースとして定義し、関数の引数で受け取る。WXT による実装は `entrypoints/platform/` に置き、エントリポイント（`background.ts`・`popup/app.tsx`・`options/app.tsx`）が作って渡す。`components/` へは props で渡す。

- 採用理由: 置き換えるときに書き直すのが `entrypoints/` だけになる。`utils/` のテストが `fakeBrowser` を使わず、手書きの偽物で済む
- `entrypoints/platform/` は `index` を持たないため、WXT はエントリポイントとして扱わない。popup・options・background が共有するため、どれか1つのエントリポイントのディレクトリには置かない
- 却下した案: Preact の Context で渡す。props の受け渡しが 1〜2 段しか無く、Context の仕組みを足すほどではない

### background を `entrypoints/background/` に分ける

WXT による実装を組み立てる分だけ `background.ts` の依存が増え、`import/max-dependencies`（10）を超える。`entrypoints/background/index.ts`（起動時の組み立て）、`logs.ts`（捕捉されないエラーの記録とログの依頼の処理）、`grouping.ts`（グループ化のイベントの購読）に分ける。WXT は `background/index.ts` を `background.ts` と同じエントリポイントとして扱う。

### ストレージは値1つ分のインターフェースにし、キー・既定値・版の定義は `utils/` に置く

`utils/storage/item.ts` に `StorageItem<T>`（`getValue`・`setValue`・`removeValue`・`watch`）と、その定義の `StorageItemDefinition<T>`（`key`・`fallback`）を置く。`getValue`・`watch` は保存された値の形を確かめないため、`unknown` で返す。ルール・ログの読み込みはすでに `unknown` として確かめている。

保存する値の定義（`local:rules` 等）は、何を保存するかの知識のため `utils/` に置き、`entrypoints/platform/storage.ts` の `defineStorageItem` が WXT の `storage.defineItem` に渡す。

- 定義には版（WXT の `version`）を持たせない。WXT は `migrations` を渡したときだけ版を確かめて `<key>$` に保存し、`version` を省くと 1 とする（`@wxt-dev/storage` 1.2.9 の `defineItem`）。これまでの `version: 1` は `migrations` が無く、省いたときと振る舞いが変わらない。データの形を変えるときに、版と移す処理を定義に加える
- `utils/rules/storage.ts` の `watchRules` と `watchRuleChanges` は、変更前の値を渡すかだけが違うため、`RulesStore` の `watch` 1つにまとめる

### タブ・タブグループはグループ化に要る操作だけのインターフェースにする

`utils/grouping/tabs.ts` の `TabsApi` は、通常のウィンドウのタブの取得、タブグループの取得、グループへの追加・作成、グループからの除外、タイトル・色の変更、移動だけを持つ。`browser` の型をそのまま受け取ると、WXT（`@wxt-dev/browser`）の型に依存し続けるため、必要なプロパティだけの型にする。

### LogTape を使うのを `utils/logging/setup.ts` だけにする

`utils/logging/logger.ts` に `Logger`（`debug`・`info`・`warn`・`error`）、`LogLevel`、ログの1件の `LogEvent`、`compareLogLevel` を置く。ほかのコードはこれらの型を使い、LogTape の `getLogger`・`configureSync` 等を呼ぶのは `setup.ts` だけにする。LogTape の `Logger`・`LogRecord` は構造的にこれらの型に代入できるため、変換を挟まない。

- メッセージの `{name}` を `properties` の値で埋める書き方は LogTape のもの。置き換えるときは、`setup.ts` で同じ書き方を解釈する
- ロガーは今どおり、各モジュールが `getAppLogger` で取得する。置き換えるときに書き直すのは `setup.ts` だけで済むため、引数で渡すようにはしない

### Preact は `entrypoints/` でも使う

`popup/main.tsx`・`options/main.tsx` が `render` で描画を始め、`app.tsx` は JSX で画面を組み立てる。画面の起点のため、`entrypoints/` での Preact は認める。

### import の制限は Oxlint の `no-restricted-imports` の `group` で、ディレクトリごとに許可するものを並べる

`.oxlintrc.jsonc` の `overrides` で、`utils/**`・`components/**`・`entrypoints/**` ごとに `group: ["*", "!./**", "!../**", "!<許可するパッケージ>", "**/<禁じるディレクトリ>/**"]` を書く。許可するものを並べるため、新しいパッケージを入れたときも検出される。

- `overrides` は後に書いたものがルールの設定を置き換えるため、テスト・テスト用ヘルパーの設定をディレクトリの設定より後に書く
- 先読みの `regex` は Oxlint で効かないため使わない
- パスのエイリアス（`@`・`~`）の禁止（ADR 0012）は、`group` の `*` に含まれる

### WXT の自動インポートを無効にする

`wxt.config.ts` に `imports: false` を書く。import を書かずに使った WXT の API を型チェックで検出できるようにし、`no-restricted-imports` を回避できないようにする。

## Risks / Trade-offs

- [エントリポイントでの組み立てが増える] → 組み立ては1つのエントリポイントにつき数行で、`entrypoints/platform/` の関数を呼ぶだけにする
- [`entrypoints/platform/` の実装を確かめる範囲が狭い] → WXT の API をそのまま呼ぶだけの薄い層にする。ストレージは定義のキーで読み書きすることを Vitest（WXT の `fakeBrowser`）で、タブは E2E のテストで確かめる
- [WXT が将来 `entrypoints/<名前>/` の `index` 以外のファイルもエントリポイントとして扱うようになる] → ビルドで余計なエントリポイントができるか、エラーになるため気づける
