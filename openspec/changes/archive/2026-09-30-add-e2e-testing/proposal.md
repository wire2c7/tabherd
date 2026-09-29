# Proposal

## Why

ブラウザの API を実際に呼ぶ部分（タブ・タブグループの操作、Service Worker のイベント）と設定画面の操作は、Vitest の単体テストで確かめられず、#13 では手動の確認として扱っていた。拡張機能を読み込んだブラウザで自動で確かめるテストと、エージェントがブラウザを操作して確かめる手段を用意する（#26）。基盤と CI（#27）、手順の E2E テスト化（#28）、Playwright MCP（#29）に分けて進める。

## What Changes

- E2E テストに Playwright（`@playwright/test`）を使い、nixpkgs の Chromium に拡張機能を読み込ませて実行する
- Chromium は E2E 用の devShell（`devShells.e2e`）にだけ入れ、既定の devShell には入れない
- 拡張機能を読み込んだ Chromium を起動する fixture と、テスト用のローカルの HTTP サーバーを用意する
- #13 のタスク 2.5・3.2・4.4・5.5 の手順を E2E テストにする
- CI に E2E のジョブを追加し、`build` ジョブとは別に PR ごとに実行する
- エージェントがブラウザを操作して確かめる手段として Playwright MCP（`@playwright/mcp`）を入れる。版を固定し、`.mcp.json` から E2E の devShell 経由で起動する。任意のコードを実行するツールは Claude Code の権限設定で使えないようにする
- 上の判断を ADR に残し、実行方法を `AGENTS.md` に書く

## Capabilities

### New Capabilities

なし（開発用のテストとツールの追加で、拡張機能の振る舞いは変わらない）

### Modified Capabilities

なし

## Impact

- `flake.nix`: `devShells.e2e` を追加する（Linux のみ）
- `package.json`: devDependencies に `@playwright/test`・`@playwright/mcp` を追加し、E2E を実行するスクリプトを加える
- `e2e/`（新規）: Playwright の設定・fixture・テスト・Playwright MCP の起動用スクリプト
- `tsconfig.node.json`・`vitest.config.ts`: E2E のファイルを型チェックの対象に含め、Vitest の対象からは外す
- `.github/workflows/ci.yaml`: `e2e` ジョブを追加する
- `.mcp.json`（新規）・`.claude/settings.json`: Playwright MCP の登録と、使えるツールの制限
- `AGENTS.md`: E2E テストと Playwright MCP の使い方
- `docs/adr/`: E2E テストとブラウザで確かめる手段についての ADR
