# 0015. Playwright MCP のファイルの読み書き先を PreToolUse フックで `.playwright-mcp/` に制限する

- ステータス：Accepted
- 日付：2026-10-02
- 関連 Issue：#44

## コンテキスト

ADR 0014 で、Playwright MCP のツールの `filename` が `.playwright-mcp/` の外を指す呼び出しを、Claude Code の PreToolUse フックで拒否することにした。そのフックに次の問題が見つかった。

- パスを文字列で比べていた。サーバーは `filename` を字句的に正規化した後、シンボリックリンクを解決してから、出力先かワークスペース（roots）の中かを確かめる。このため、`.playwright-mcp/` の中から外を指すシンボリックリンクを経由すると外に書ける
- jq が無いときだけ拒否していた。Claude Code は、フックが終了コード 2 以外で失敗すると呼び出しを通す。このため、jq の実行時エラー等ではツールがそのまま実行される
- `browser_file_upload`・`browser_drop` の `paths` を制限しないとしていた。しかし、これらを使うとリポジトリの任意のファイル（`.env` 等）を開けるページに渡し、スナップショットで読み出せる。この読み出しは Claude Code の Read の許可を通らない
- テストが無く、Playwright MCP の更新で引数が変わっても気づけない

## 検討した選択肢

- **`paths` を制限しないままにする（ADR 0014 のまま）**：ページにファイルを渡す確認がしやすいが、リポジトリのファイルを Read の許可なしに読み出せる
- **`paths` も `.playwright-mcp/` の中に制限する**：ページに渡すファイルは `.playwright-mcp/` に置く手間が増える。今の拡張機能にはファイルを選ぶ機能が無いため、困る場面は少ない

## 決定

- フック（`.claude/hooks/playwright-mcp-file-guard.sh`）で、`filename` と `paths` の各要素が `.playwright-mcp/` の外を指す呼び出しを拒否する。それ以外は ADR 0014 と同じく Claude Code の設定で守る
- パスはサーバーと同じ順で解決する。字句的に正規化してから（`realpath -m -s`）シンボリックリンクを解決し（`realpath -m`）、`.playwright-mcp/` の中かを比べる。`.playwright-mcp/` 自体がシンボリックリンクのときは拒否する
- フックが途中で失敗したときは、終了コードを 2 に置き換えて拒否する
- フックのテスト（`.claude/hooks/playwright-mcp-file-guard.test.sh`）を prek のフックで実行する

## 結果

- Claude Code から Playwright MCP を使っても、`.playwright-mcp/` の外のファイルは読み書きできない
- ページにファイルを渡すときは、そのファイルを `.playwright-mcp/` に置く必要がある
- フックは GNU coreutils の `realpath`（`-m`・`-s`）と jq 1.7 以降（`--raw-output0`）を使う。これらが無い環境では、Playwright MCP のすべての呼び出しが拒否される
- Playwright MCP の更新でパスを受け取る引数の名前が変わると、フックは調べなくなる。更新のときは、パスを受け取る引数が `filename`・`paths` のままかを README で確かめる
