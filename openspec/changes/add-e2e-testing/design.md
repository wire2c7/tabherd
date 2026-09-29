# Design

## Context

- 単体テストは Vitest（`*.test.ts`）で、WXT の fake-browser は `tabGroups` に対応していない
- 既定の devShell（`devShells.default`）は Node.js・pnpm・フォーマッタ等だけで、ブラウザを含まない。flake は `nix-systems/default`（Linux・macOS）を対象にしている
- CI は共通の `ci` ジョブと、`nix develop --command` で整形・lint・型チェック・テスト・ビルドを行う `build` ジョブの2つ。Nix のキャッシュ（magic-nix-cache 等）は使っていない
- ブランドの Google Chrome は Chrome 137 以降 `--load-extension` を受け付けない
- pnpm は `minimumReleaseAge`（3日）・`trustPolicy: no-downgrade` で依存を審査している（ADR 0006）
- #13 の一時的な検証で、次の構成が動くことを確かめた（詳しくは #26 の背景・現状）
  - nixpkgs の `playwright-driver.passthru.components.chromium`（Playwright 1.63.0 用の Chromium 153）に、`launchPersistentContext` の `args` で `--load-extension` を渡す。ヘッドレスでも WSLg での表示でも動く
  - Service Worker は `context.serviceWorkers()` / `waitForEvent("serviceworker")` で取れ、拡張機能の ID はその URL のホスト。`sw.evaluate` で `chrome.*` を呼べる
  - Playwright MCP（0.0.83）の設定ファイルの `launchOptions` で同じ Chromium と `--load-extension` を渡すと、拡張機能を読み込める。Playwright 1.64 の alpha 版に依存するが、1.63 用の Chromium で動いた

## Goals / Non-Goals

**Goals:**

- `nix develop .#e2e` の中で、ビルドから E2E テストまでを1つのコマンドでヘッドレスに実行できる
- 既定の devShell と `build` ジョブの依存に、ブラウザを加えない
- エージェントが、同じ Chromium と拡張機能のビルドを Playwright MCP で操作できる

**Non-Goals:**

- Firefox・WebKit・macOS でのテスト（nixpkgs の Playwright のブラウザは Linux 向け）
- 見た目の回帰テスト（スクリーンショットの比較）。このため、E2E の devShell に日本語フォントは入れない
- ツールバーから開く本物のポップアップ（Playwright から開けない）と、タブのドラッグ中の API のリトライ（再現できない）の自動化。これらは `test.fixme` のテストとして残す（Decisions の「自動で確かめられない確認」）
- Nix のキャッシュによる CI の高速化

## Decisions

### ツールは Playwright

`@playwright/test` をテストランナーごと使う。

- 採用理由: 拡張機能の読み込み・Service Worker の取得・HTML5 Drag and Drop（`dragTo`）が動くことを #13 で確かめた。nixpkgs に対応する Chromium がある。fixture・並列実行・失敗時のトレースが揃っている
- 却下した案: Puppeteer は Chrome 専用で軽いが、テストランナーを別に用意する必要があり、nixpkgs でブラウザの版を揃える手段も Playwright ほど整っていない。E2E を入れず手動の確認のままにする案は、#13 の確認の手順（52 項目）を毎回手で行う手間と、確認漏れの危険が大きい

### ブラウザは nixpkgs の Chromium を E2E 用の devShell にだけ入れる

`flake.nix` に `devShells.e2e` を追加する。既定の devShell のパッケージと `shellHook` を `inputsFrom` で引き継ぎ、Chromium を加える。環境変数（`OPENSPEC_TELEMETRY` 等）は `inputsFrom` では引き継がれないはずなので、実装時に確かめ、必要なら共通の値として両方の devShell に渡す。Chromium の実行ファイルの場所は環境変数（`TABHERD_E2E_CHROMIUM`）で渡し、Playwright の `launchOptions.executablePath` に使う。

- 採用理由: Chromium は依存を含めて約 690 MiB あり、既定の devShell に入れると、普段の `nix develop` と CI のすべてのジョブで取得することになる。全ブラウザを含む `playwright-driver.browsers`（約 2.2 GiB）ではなく、Chromium の component だけを使う
- `PLAYWRIGHT_BROWSERS_PATH` でブラウザの置き場所を教える方法は採らない。npm の `@playwright/test` と nixpkgs の `playwright-driver` の版が完全に一致しないとブラウザを見つけられず、nixpkgs の更新と npm の更新（Renovate）を常に同時に行う必要が出るため。`executablePath` なら、版が多少ずれても動く（Playwright MCP で確かめた）。それでも CDP の互換性のため、`@playwright/test` は nixpkgs の `playwright-driver` と同じ版を基本とし、ずれたら揃える
- Playwright が npm 経由でブラウザをダウンロードする案（`playwright install`）は、Nix で管理する方針（AGENTS.md）から外れ、NixOS 等では共有ライブラリが足りず動かないため採らない
- `devShells.e2e` は Linux（`x86_64-linux`・`aarch64-linux`）のみで定義する

### テストの配置と実行

- `e2e/` に、`playwright.config.ts`・fixture（`fixtures.ts`）・テスト（`*.e2e.ts`）を置く。拡張子を `*.e2e.ts` にし、Vitest の既定の対象（`*.test.ts`・`*.spec.ts`）と重ならないようにする。念のため `vitest.config.ts` の `exclude` にも `e2e/**` を加える
- `package.json` に `e2e` スクリプト（`wxt build && playwright test`）を加える。テストはビルドの出力（`.output/chrome-mv3/`）を読み込む
- `TABHERD_E2E_CHROMIUM` がないとき（E2E の devShell の外）は、fixture が「`nix develop .#e2e` の中で実行する」旨のエラーで止める
- E2E のファイルは Node.js で動くため `tsconfig.node.json` の `include` に加える。`sw.evaluate` に渡す関数の中の `chrome.*` の型は、`@types/chrome` を足さずに WXT の `browser` の型で書けるかを実装時に確かめ、無理なら型注釈を最小限にする
- 既定はヘッドレス。WSLg 等で表示して確かめるときは Playwright の `--headed` を使う

### fixture

テストごとに新しい永続コンテキスト（一時的なプロフィール）で Chromium を起動する。

- `context`: `launchPersistentContext` に `--disable-extensions-except`・`--load-extension` を渡して起動する
- `serviceWorker`・`extensionId`: Service Worker を待ち、その URL から ID を得る
- `server`: どのパスにもパスを表示するだけの HTML を返すローカルの HTTP サーバー（`127.0.0.1` の空いているポート）。外部のネットワークに依存しない
- 状態の確認と操作の補助（ルールの保存、ウィンドウごとのタブとグループの一覧）は、`serviceWorker.evaluate` で `chrome.storage`・`chrome.tabs`・`chrome.tabGroups` を呼ぶ関数にまとめる
- Service Worker とページのエラーのログを集め、各テストの最後に空であることを確かめる
- 採用理由: テストごとに起動すると1回 1 秒程度かかるが、ルール・タブ・グループの状態がテストをまたいで残らない。テストの数が増えて遅くなったら、ワーカー単位の起動と状態のリセットに切り替える

### E2E テストにする手順

## 13 の一時的な検証の 52 項目を、次のファイルに分ける。各テストの名前は Spec（`openspec/specs/`）のシナリオに対応させる。

- `auto-grouping.e2e.ts`: タスク 2.5・3.2（グループ化・移動・解除・別ウィンドウ・名前と色の変更・削除・ピン留め・手動のグループ・並び）
- `rule-settings.e2e.ts`: タスク 4.4（追加・編集・削除・検証・保存・画面間の同期・幅）。ポップアップは `popup.html` をタブで開き、幅を 400px にして確かめる
- `reorder.e2e.ts`: タスク 5.5（ドラッグ・キーボード・フォーカス・タブバーへの反映）

待ち合わせは固定の待ち時間ではなく、Playwright の `expect.poll` で状態が変わるまで待つ。ルールの変更のデバウンス（300ms）をまたぐ確認も同じ。

### 自動で確かめられない確認

E2E テストで確かめられない既知の制約は、`test.fixme` のテストとして E2E のテストの中に残す。details の `annotation`（`type: "manual"`）に、手で確かめる手順を書く。

- 対象: ツールバーから開く本物のポップアップ（大きさ・一覧のスクロール）、タブのドラッグ中の API のリトライ
- 採用理由: 確かめていないことがテストの一覧とレポートに残り、手で確かめる手順もそこから分かる。design.md や Issue に書くだけだと、テストを読む人から見えない
- `test.fail` は使わない。`test.fail` はテストを実行して失敗することを確かめるもので、Playwright から行えない操作では、中身が「わざと失敗させる」だけの意味のないテストになる。`test.fail` は、今のコードで失敗すると分かっている振る舞い（未対応の機能・既知のバグ）を残すときに使う

### CI

`.github/workflows/ci.yaml` に `e2e` ジョブを追加する。`build` ジョブと並列に、PR ごとに実行する。

- 手順: `nix develop .#e2e --command pnpm install --frozen-lockfile` → `nix develop .#e2e --command pnpm e2e`
- 失敗したときは Playwright のレポートとトレースを artifact として残す（`actions/upload-artifact` をコミットハッシュで固定）
- 毎回 Chromium を cache.nixos.org から取得するため数分かかる。遅さが問題になったら、Nix のキャッシュの導入を別に検討する
- 採用理由: `build` ジョブに含めると、E2E のためだけに `build` ジョブが重くなり、失敗の原因も切り分けにくくなる。手動・定期の実行だけにすると、壊れたことに PR の時点で気づけない

#### Playwright MCP

- `@playwright/mcp` を devDependencies に版を固定して追加する（`minimumReleaseAge` を満たす版。2026-09-30 時点では 0.0.82 以前）。README の `npx @playwright/mcp@latest` は ADR 0006 の審査を通らないため使わない
- 起動用のスクリプト（`e2e/mcp-server.sh`）が、E2E の devShell の Chromium と、ビルドの出力（`.output/chrome-mv3/`）の絶対パスで設定ファイルを組み立て、`pnpm exec` で Playwright MCP を起動する。`.mcp.json` からは `nix develop .#e2e --command e2e/mcp-server.sh` で呼ぶ
- ブラウザは `--isolated`（プロフィールを保存しない）・ヘッドレスで起動する。表示して見たいときの切り替えは環境変数で行う
- 拡張機能の ID は、パッケージ化していない拡張機能ではフォルダの絶対パスから決まる（SHA-256 の先頭 32 桁を a〜p に置き換えたもの）。エージェントが ID を得られるよう、ID を表示するスクリプト（`pnpm e2e:extension-id`）を用意する
- Playwright MCP には個々のツールを無効にするオプションがないため、任意のコードを Playwright のサーバーのプロセスで実行する `browser_run_code_unsafe` は、`.claude/settings.json` の `permissions.deny` で使えないようにする。ページの中で JavaScript を実行する `browser_evaluate` は、拡張機能のページから `chrome.*` を呼んで状態を確かめるのに使うため許す
- 開くオリジンは `--allowed-origins` で `http://127.0.0.1` と拡張機能のページに絞る。README のとおりこれはセキュリティの境界ではなく、エージェントが意図せず外部のサイトを開かないようにするためのもの。`chrome-extension://` とポートの指定がこのオプションで書けるかは実装時に確かめ、書けなければ絞らず、その旨をこの design.md に残す（ADR には、オリジンの制限は補助でありセキュリティの境界ではないという判断だけを書く）
- ビルドは自動で行わない。エージェントは `pnpm build` の後に Playwright MCP を使う

#### ADR

上の判断（ツール・ブラウザの供給元・依存の置き場所・CI での実行・Playwright MCP）を、1つの ADR（`docs/adr/0013-...`）にまとめて残す。どれも「拡張機能をブラウザで確かめる手段」という1つの問題に対する判断で、互いに前提になっているため。

### Risks / Trade-offs

- [nixpkgs の更新で Chromium の版が上がり、`@playwright/test` と CDP の互換性が崩れる] → Renovate の nixpkgs の更新 PR で E2E のジョブが落ちるので、そこで `@playwright/test` の版を揃える
- [CI の E2E のジョブが、Chromium の取得で毎回数分かかる] → 当面は許容する。問題になったら Nix のキャッシュを別に検討する
- [Playwright MCP は 1.0 前で更新が頻繁、かつ alpha 版の Playwright に依存する] → 版を固定し、Renovate の更新で壊れたら固定を戻す。E2E テストは Playwright MCP に依存しないため、壊れても CI は止まらない
- [`--allowed-origins` はセキュリティの境界ではない] → 任意のコードを実行するツールは権限設定で禁じる。Playwright MCP を使うのは、ローカルのサーバーと拡張機能のページを確かめるときに限る
- [テストごとに Chromium を起動するため、テストが増えると遅くなる] → 必要になったらワーカー単位の起動に切り替える
- [ヘッドレスの Chromium と本物のポップアップでは、サイズや表示が異なりうる] → 本物のポップアップは引き続き手で確かめる（Non-Goals）

### Migration Plan

新しく追加するだけで、既存の開発の流れ（既定の devShell・`build` ジョブ）は変わらない。やめるときは、`devShells.e2e`・`e2e/`・`e2e` ジョブ・`.mcp.json` を消し、devDependencies を外す。
