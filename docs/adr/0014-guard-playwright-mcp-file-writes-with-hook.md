# 0014. Playwright MCP のファイルの書き込み先を PreToolUse フックで `.playwright-mcp/` に制限する

- ステータス：Accepted
- 日付：2026-10-02
- 関連 Issue：#42

## コンテキスト

Playwright MCP（0.0.82）の多くのツール（`browser_evaluate`・`browser_take_screenshot`・`browser_snapshot` 等）は、`filename` 引数で結果をファイルに保存できる。サーバーが書き込みを許す範囲は、出力先（`.playwright-mcp/`）とワークスペースの中である。ワークスペースは MCP のクライアントが渡す roots の最初のパスで、Claude Code はプロジェクトのディレクトリ（リポジトリの直下）を渡す。

`browser_evaluate` は関数の戻り値を `JSON.stringify` して書くため、リポジトリの中の任意のファイルを任意の JSON で上書きできる。例えば `.claude/settings.json` を書き換えて `permissions.deny` を外せる。この書き込みは Claude Code の Edit・Write の許可の確認を通らない。

前提と制約:

- Playwright MCP には、ワークスペースを指定する設定も、`filename` を無効にする設定もない（`allowUnrestrictedFileAccess` は範囲を広げる向きにしか働かない）
- ADR 0013 で、`browser_evaluate` は拡張機能のページから `chrome.*` を呼んで確かめるのに使うため許している
- Claude Code の権限ルールは MCP のツールの引数を見られない

## 検討した選択肢

- **`e2e/mcp-server.sh` の作業ディレクトリを一時ディレクトリにする**：roots を渡すクライアントではワークスペースが roots で決まるため、Claude Code では範囲が変わらない
- **roots を除く中継を挟む**：`e2e/mcp-server.sh` でサーバーとの間に中継を置き、initialize から roots の capability を除くと、ワークスペースがプロセスの作業ディレクトリになる。クライアントやサーバー名に依存しないが、MCP の通信に手を入れるため保守が重く、壊れてもリポジトリが書ける状態に戻るだけで気づきにくい
- **Claude Code の PreToolUse フックで拒否する**：Playwright MCP のツールの呼び出しのうち、`filename` が `.playwright-mcp/` の外を指すものを拒否する。数十行のシェルで済む。Claude Code にしか効かず、`browser_run_code_unsafe` の deny と同じくサーバー名に依存する
- **AGENTS.md に注意を書くだけにする**：変更は最小だが、技術的には塞がない

## 決定

- Claude Code の PreToolUse フック（`.claude/hooks/playwright-mcp-file-guard.sh`）で、`mcp__playwright__` のツールの `filename` が `.playwright-mcp/` の外を指す呼び出しを拒否する。`..` を含むパスは正規化せずに拒否し、jq が無く調べられないときも拒否する
- `browser_run_code_unsafe` の deny（ADR 0013）と同じく、Claude Code の設定で守る。他のエージェントに登録する場合は、`browser_run_code_unsafe` とあわせて、そのエージェントで書き込み先を制限する方法を決める

## 結果

- Claude Code から Playwright MCP を使っても、`.playwright-mcp/` の外にファイルを書けない
- `filename` に相対パスで `result.json` 等と書くと拒否されるため、`.playwright-mcp/result.json` のように書く必要がある
- ファイルを読み込む `browser_set_storage_state` の `filename` も `.playwright-mcp/` の中に限られる。一方、`browser_file_upload`・`browser_drop` の `paths` は制限していないため、リポジトリのファイルを開けるページ（`127.0.0.1` と拡張機能のページ）に渡せる
- サーバー名を変えて登録するとフックは効かない。Playwright MCP がワークスペースを指定する設定や `filename` を無効にする設定を備えたら、サーバー側の制限に置き換える
