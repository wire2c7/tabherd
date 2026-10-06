# 0021. WXT・Preact・LogTape を使うコードをディレクトリに閉じ込める

- ステータス：Accepted
- 日付：2026-10-04
- 関連 Issue：#63

## コンテキスト

WXT（ADR 0002）・Preact（ADR 0003）・LogTape（ADR 0017）を、いつでも置き換えられるようにしたい。置き換えるときに書き直す範囲が、決まったディレクトリに収まっている必要がある。

決める前は、`utils/` の 5 ファイルと `components/` の 2 ファイルが WXT の `browser`・`storage` を直接使い、LogTape の型も `utils/` の各所で使っていた。これを検査する仕組みは無く、WXT の自動インポートにより import を書かずに WXT の API を使えた。

前提と制約:

- WXT は `entrypoints/` の直下のファイルと `entrypoints/<名前>/index.*` だけをエントリポイントとして扱う
- Oxlint の `no-restricted-imports` の `regex` は、先読み（`(?!…)`）を使うと何も検出しない（エラーも出ない）。gitignore 形式の `group` は `!` での除外が効く（Oxlint 1.85.0）
- WXT の storage は、`migrations` を渡したときだけ値の版を `<key>$` に `{ v }` として保存する。ルール・ログの値は `migrations` を渡しておらず、版は保存されていない

## 検討した選択肢

### WXT の API の渡し方

- **`utils/` にインターフェースを置き、WXT による実装を `entrypoints/` から引数・props で渡す**：置き換えるときに書き直すのが `entrypoints/` だけになる。`utils/` のテストが WXT の `fakeBrowser` を使わずに済む。一方、エントリポイントでの組み立てが増える
- **WXT の API を包むモジュールを `utils/` に置き、ほかのコードはそれを import する**：組み立ては要らない。一方、`utils/` が WXT に依存したままになり、決めたディレクトリの分け方に反する
- **Preact の Context で `components/` に渡す**：props を何段も渡さずに済む。今は 1〜2 段しか無く、仕組みを足すほどではない

### LogTape の閉じ込め方

- **自前の `Logger` 等の型を置き、LogTape を使うのを `utils/logging/setup.ts` だけにする**：置き換えるときに書き直すのが `setup.ts` だけになる。LogTape の `Logger`・`LogRecord` は自前の型に構造的に代入できるため、変換を挟まない
- **ロガーも引数で渡す**：モジュールがロガーの実装を import しなくなる。一方、ほぼすべての関数の引数が増え、置き換えのしやすさは上の案と変わらない

### import の制限の検査

- **Oxlint の `no-restricted-imports` の `group` で、ディレクトリごとに許可するものを並べる**：既存の lint で検査でき、新しいパッケージを入れたときも検出される
- **禁じるパッケージを並べる**：書くのは簡単だが、新しいパッケージを入れたときに検出されない
- **dependency-cruiser 等の依存関係の検査ツールを入れる**：表現力は高いが、ツールが1つ増える

## 決定

ディレクトリごとに使えるパッケージを次のように決める。

- WXT（`wxt`）を使うのは `entrypoints/` だけ。WXT による実装は `entrypoints/platform/`（`index` を持たず、エントリポイントにならない）に置く
- Preact（`preact`）を使うのは `components/` と `entrypoints/` だけ。`entrypoints/` は画面の描画の起点のため認める
- `utils/` が使う外部パッケージは `valibot` と、`utils/logging/setup.ts` の `@logtape/logtape` だけ。テストとテスト用ヘルパー（`testing/`）は `vitest`・`fast-check`・`@logtape/logtape` も使ってよい
- `utils/` は `components/`・`entrypoints/` を、`components/` は `entrypoints/` を import しない

`utils/` が使うブラウザの API（タブ・タブグループ、ストレージ）は `utils/` にインターフェースとして置き、エントリポイントが WXT による実装を引数・props で渡す。保存する値の定義（キー・既定値）は `utils/` に置く。

これを Oxlint の `no-restricted-imports` の `group` で検査し、WXT の自動インポートを無効にする（`imports: false`）。

## 結果

- WXT を置き換えるときに書き直すのは `entrypoints/`、Preact は `components/` と `entrypoints/`、LogTape は `utils/logging/setup.ts` に限られる
- `utils/` のテストは、WXT の `fakeBrowser` ではなく手書きの偽物を使う
- エントリポイントで、WXT による実装を作って渡す組み立てが増える
- WXT を置き換えるときは、WXT の storage が保存した値（`chrome.storage` の、`local:` 等を除いたキー）を読めるようにする必要がある。データの形を変えて版を持たせるときは、版の保存の形も置き換え先で読めるようにする
- ログのメッセージの `{name}` を埋める書き方は LogTape のもののため、LogTape を置き換えるときは `setup.ts` で同じ書き方を解釈する
- `entrypoints/platform/` の実装は WXT の API をそのまま呼ぶだけにし、WXT の `fakeBrowser` を使う Vitest で確かめる
- 新しいパッケージを `utils/`・`components/` で使うには、`.oxlintrc.jsonc` の許可に加える必要がある
