# Tasks

## 1. E2E テストの基盤と CI（#27）

- [x] 1.1 `flake.nix` に Linux のみの `devShells.e2e` を追加し（既定の devShell を `inputsFrom` で引き継ぎ、nixpkgs の Chromium の component を加え、`TABHERD_E2E_CHROMIUM` を設定する）、`nix develop .#e2e --command bash -c '"$TABHERD_E2E_CHROMIUM" --version'` が Chromium の版を表示し、`nix develop` の依存に Chromium が含まれないことを確かめる
- [x] 1.2 `@playwright/test` を nixpkgs の `playwright-driver` と同じ版で `pnpm add -D` し、`pnpm install` が `minimumReleaseAge`・`trustPolicy` に通ることを確かめる
- [x] 1.3 `e2e/playwright.config.ts` と、`context`・`serviceWorker`・`extensionId`・`server` とエラーのログの確認を持つ fixture（`e2e/fixtures.ts`）を作り、`TABHERD_E2E_CHROMIUM` がないときに E2E の devShell で実行するよう促すエラーになることを確かめる
- [x] 1.4 `tsconfig.node.json` の `include` に `e2e` を加え、`vitest.config.ts` の `exclude` に `e2e/**` を加えて、`pnpm typecheck`・`pnpm test` が通り、Vitest が E2E のファイルを実行しないことを確かめる
- [x] 1.5 `package.json` に `e2e` スクリプト（`wxt build && playwright test`）を加え、拡張機能が読み込まれ Service Worker が起動することだけを確かめるテストを1つ書き、`nix develop .#e2e --command pnpm e2e` がヘッドレスで通ることを確かめる
- [x] 1.6 `.github/workflows/ci.yaml` に `e2e` ジョブ（`nix develop .#e2e` で `pnpm install`・`pnpm e2e`、失敗時にレポートを artifact に残す）を追加し、actionlint が通り、PR で `e2e` ジョブが通ることを確かめる
- [x] 1.7 ツール・ブラウザの供給元・依存の置き場所・CI での実行・Playwright MCP の判断を `docs/adr/` に ADR として残す
- [x] 1.8 `AGENTS.md` のコマンドに `nix develop .#e2e --command pnpm e2e` を加え、`.gitignore` に Playwright の出力（`test-results/`・`playwright-report/`）を加えて、`prek run --all-files`・`nix flake check` が通ることを確かめる

## 2. 手順の E2E テスト化（#28）

- [x] 2.1 状態の確認と操作の補助（ルールの保存、ウィンドウごとのタブとグループの一覧）を fixture に加える
- [x] 2.2 `e2e/auto-grouping.e2e.ts`・`e2e/group-order.e2e.ts` に #13 のタスク 2.5・3.2 の手順（グループ化・移動・解除・別ウィンドウ・名前と色の変更・削除・ピン留め・手動のグループ・並び・並びが正しいときに移動しない）を書き、`pnpm e2e` で通ることを確かめる
- [x] 2.3 `e2e/rule-settings.e2e.ts` に #13 のタスク 4.4 の手順（追加・編集・削除・検証のエラー・保存・画面間の同期・連続入力・幅）を書き、`pnpm e2e` で通ることを確かめる
- [x] 2.4 `e2e/reorder.e2e.ts` に #13 のタスク 5.5 の手順（ドラッグ・キーボード・フォーカス・先頭と末尾の無効化・タブバーへの反映）を書き、`pnpm e2e` で通ることを確かめる
- [x] 2.5 自動で確かめられない確認（ツールバーから開く本物のポップアップ、タブのドラッグ中の API のリトライ）を、手で確かめる手順を `annotation` に書いた `test.fixme` のテストとして残し、`pnpm e2e` のレポートに fixme として表示されることを確かめる
- [x] 2.6 わざと実装を壊したとき（例: ルールの順番の並び替えを止める）に該当する E2E テストが落ちることを確かめ、元に戻す
- [x] 2.7 CI の `e2e` ジョブで全テストが通り、所要時間を PR に記録する

## 3. Playwright MCP（#29）

- [x] 3.1 `@playwright/mcp` を `minimumReleaseAge` を満たす版で `pnpm add -D` し、`pnpm install` が通ることを確かめる
- [x] 3.2 `e2e/mcp-server.sh`（E2E の devShell の Chromium とビルドの出力の絶対パスで設定を組み立てて起動する）と、拡張機能の ID を表示する `pnpm e2e:extension-id` を作り、`pnpm build` の後に MCP のクライアントから `popup.html` を開いて `browser_snapshot` でルールの一覧が読めることを確かめる
- [x] 3.3 `--allowed-origins` で `http://127.0.0.1` と拡張機能のページだけに絞れるかを確かめ、絞れればそのように設定し、外部のサイトを開けないことを確かめる。絞れなければ設定せず、その旨を design.md に残す
- [x] 3.4 `.mcp.json` に Playwright MCP を登録し、`.claude/settings.json` の `permissions.deny` に `browser_run_code_unsafe` を加えて、Claude Code から Playwright MCP のツールが使え、`browser_run_code_unsafe` が拒否されることを確かめる
- [x] 3.5 `AGENTS.md` に Playwright MCP の使い方（`pnpm build` の後に使う、拡張機能の ID の求め方）を書き、`prek run --all-files`・`nix flake check` が通ることを確かめる

## 4. 全体の確認（#26）

- [x] 4.1 `pnpm lint`・`pnpm typecheck`・`pnpm test`・`pnpm build`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check` が通ることを確かめる
- [x] 4.2 実装と design.md の食い違いを見直し、あれば design.md を実装に合わせて直す
