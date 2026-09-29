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

`flake.nix` に `devShells.e2e` を追加する。既定の devShell のパッケージと `shellHook` を `inputsFrom` で引き継ぎ、Chromium を加える。環境変数（`OPENSPEC_TELEMETRY` 等）は `inputsFrom` では引き継がれないため、`inherit (config.devShells.default)` で重ねて渡す。Chromium の実行ファイルの場所は環境変数（`TABHERD_E2E_CHROMIUM`）で渡し、Playwright の `launchOptions.executablePath` に使う。実行ファイルのディレクトリ名はアーキテクチャで異なり（`chrome-linux64`・`chrome-linux-arm64`）、nixpkgs はこの名前を公開していないため、`shellHook` で探して設定する。

- 採用理由: Chromium は依存を含めて約 690 MiB あり、既定の devShell に入れると、普段の `nix develop` と CI のすべてのジョブで取得することになる。全ブラウザを含む `playwright-driver.browsers`（約 2.2 GiB）ではなく、Chromium の component だけを使う
- `PLAYWRIGHT_BROWSERS_PATH` でブラウザの置き場所を教える方法は採らない。npm の `@playwright/test` と nixpkgs の `playwright-driver` の版が完全に一致しないとブラウザを見つけられず、nixpkgs の更新と npm の更新（Renovate）を常に同時に行う必要が出るため。`executablePath` なら、版が多少ずれても動く（Playwright MCP で確かめた）。それでも CDP の互換性のため、`@playwright/test` は nixpkgs の `playwright-driver` と同じ版を基本とし、ずれたら揃える
- Playwright が npm 経由でブラウザをダウンロードする案（`playwright install`）は、Nix で管理する方針（AGENTS.md）から外れ、NixOS 等では共有ライブラリが足りず動かないため採らない
- `devShells.e2e` は Linux（`x86_64-linux`・`aarch64-linux`）のみで定義する。flake-parts の `devShells` は `lazyAttrsOf` で、`lib.mkIf` では Linux 以外にも属性が残るため、`lib.optionalAttrs` で Linux 以外の属性そのものを作らない

### テストの配置と実行

- `e2e/` に、`playwright.config.ts`・fixture（`fixtures.ts`）・テスト（`*.e2e.ts`）を置く。拡張子を `*.e2e.ts` にし、Vitest の既定の対象（`*.test.ts`・`*.spec.ts`）と重ならないようにする。念のため `vitest.config.ts` の `exclude` にも `e2e/**` を加える
- `package.json` に `e2e` スクリプト（`wxt build && playwright test`）を加える。テストはビルドの出力（`.output/chrome-mv3/`）を読み込む
- `TABHERD_E2E_CHROMIUM` がないとき（E2E の devShell の外）は、`playwright.config.ts` が「`nix develop .#e2e --command pnpm e2e` で実行する」旨のエラーで最初に止める。テストごとではなく1回だけ止まり、原因が分かりやすいため
- Playwright の出力（`test-results/`・`playwright-report/`）は、設定ファイルのある `e2e/` ではなくリポジトリの直下にできる
- E2E のファイルは Node.js で動くため `tsconfig.node.json` の `include` に加える。`sw.evaluate` に渡す関数の中の `chrome.*` の型は、`@types/chrome` を足さずに WXT の `browser` の型で書けるかを実装時に確かめ、無理なら型注釈を最小限にする
- 既定はヘッドレス。WSLg 等で表示して確かめるときは Playwright の `--headed` を使う

### fixture

テストごとに新しい永続コンテキスト（一時的なプロフィール）で Chromium を起動する。

- `context`: `launchPersistentContext` に `--disable-extensions-except`・`--load-extension` を渡して起動する
- `serviceWorker`・`extensionId`: Service Worker を待ち、その URL から ID を得る
- `server`: どのパスにもパスを表示するだけの HTML を返すローカルの HTTP サーバー（`127.0.0.1` の空いているポート）。外部のネットワークに依存しない
- 状態の確認と操作の補助は、`serviceWorker.evaluate` で `chrome.storage`・`chrome.tabs`・`chrome.tabGroups` を呼ぶ関数の fixture にまとめる
  - ルールの保存・読み出し（`setRules`・`storedRules`・`storedNames`）。`chrome.storage.local` の `rules`（WXT の storage の `local:rules`）に直接書くため、設定画面での保存と同じくバックグラウンドの `watch` に通知される
  - ウィンドウごとのタブとグループの一覧（`windows`）と、そこからパスでタブ・グループ・並びを引く関数（`findTab`・`tabIdOf`・`groupOf`・`groupOrders`・`tabLayouts`）。タブはテスト用のサーバーの URL のパスで区別する
  - 操作の補助: テスト用のサーバーのページを開く（`openTab`）、ルールと関係なくタブグループを作る（`groupTabsManually`）、設定画面をタブで開く（`openSettings`。ポップアップは幅 400px・高さ 600px）
- Service Worker とページのエラーのログを集め、各テストの最後に空であることを確かめる
- 採用理由: テストごとに起動すると1回 1 秒程度かかるが、ルール・タブ・グループの状態がテストをまたいで残らない。テストの数が増えて遅くなったら、ワーカー単位の起動と状態のリセットに切り替える

### E2E テストにする手順

一時的な検証（#13）の 52 項目を、次のファイルに分ける。各テストの名前は Spec（`openspec/specs/`）に対応させ、`describe` を Requirement、`test` を Scenario の名前にする。Scenario のない確認（画面間の同期・連続入力・幅等）は、対応する Requirement の `describe` に置く。

- `auto-grouping.e2e.ts`: タスク 2.5（グループ化・移動・解除・別ウィンドウ・名前と色の変更・削除・ピン留め・手動のグループ）
- `group-order.e2e.ts`: タスク 3.2（並び・並びが正しいときに移動しない）。Oxlint の `max-lines`（300 行）に収まるよう、`auto-grouping.e2e.ts` から Requirement「タブバー上のグループの並び」を分けた
- `rule-settings.e2e.ts`: タスク 4.4（追加・編集・削除・検証・保存・画面間の同期・幅）。ポップアップは `popup.html` をタブで開き、幅を 400px にして確かめる
- `reorder.e2e.ts`: タスク 5.5（ドラッグ・キーボード・フォーカス・タブバーへの反映）

待ち合わせは固定の待ち時間ではなく、Playwright の `expect.poll` で状態が変わるまで待つ。ルールの変更のデバウンス（300ms）をまたぐ確認も同じ。状態が変わらないことの確認と、待ち方に注意が要る確認は次のようにする。

- 「タブが動かない」ことは、バックグラウンドがタブのイベントを直列に処理することを使い、後から別のタブを開いてそれがグループに入るのを待ってから確かめる（前のイベントの処理も終わっている）
- ルールを保存してから 300ms 以内に次の変更をすると、デバウンスで1つの変更にまとまり、差分が「ルールなし → 変更後」になる。その間に `tabs.onUpdated` で作られたグループはタイトル・色が変わらない。ルールの変更を確かめるテストは、タブを先に開いてからルールを保存し、全体の判定し直しでグループに入るのを待ってから次の変更をする
- 「並びがすでに正しい」ときにグループを移動しないことは、`chrome.tabGroups.onMoved` ではなく `chrome.tabGroups.move` の呼び出しを Service Worker の中で記録して確かめる。同じ位置への `move` では `onMoved` が来ず、無駄な呼び出しを検出できないため
- 連続入力で文字が消えないことは、ページの中で1文字ごとに `setTimeout(0)` でタスクを譲りながら `input` イベントを送って確かめる。Playwright のキー入力は1文字ごとに往復するため保存の通知より遅く、通知が次の入力より後に届く順番にならない
- Spec の「インストール直後」（拡張機能の更新）は、#13 の手順になく、Service Worker が入れ替わって fixture を作り直す必要があるため、E2E テストにしていない

### 自動で確かめられない確認

E2E テストで確かめられない既知の制約は、`test.fixme` のテストとして E2E のテストの中に残す。details の `annotation`（`type: "manual"`）に、手で確かめる手順を書く。

- 対象: ツールバーから開く本物のポップアップ（大きさ・一覧のスクロール。`rule-settings.e2e.ts` の「ポップアップから開く」）、タブのドラッグ中の API のリトライ（`auto-grouping.e2e.ts`）
- `list` のレポーターでは skipped（`-`）として、HTML・JSON のレポートでは annotation の手順とともに表示される
- 採用理由: 確かめていないことがテストの一覧とレポートに残り、手で確かめる手順もそこから分かる。design.md や Issue に書くだけだと、テストを読む人から見えない
- `test.fail` は使わない。`test.fail` はテストを実行して失敗することを確かめるもので、Playwright から行えない操作では、中身が「わざと失敗させる」だけの意味のないテストになる。`test.fail` は、今のコードで失敗すると分かっている振る舞い（未対応の機能・既知のバグ）を残すときに使う

### CI

`.github/workflows/ci.yaml` に `e2e` ジョブを追加する。`build` ジョブと並列に、PR ごとに実行する。

- 手順: `nix develop .#e2e --command pnpm install --frozen-lockfile` → `nix develop .#e2e --command pnpm e2e`
- 失敗したときは Playwright のレポートとトレースを artifact として残す（`actions/upload-artifact` をコミットハッシュで固定）
- 毎回 Chromium を cache.nixos.org から取得する。それを含めても、ジョブ全体で 45〜80 秒程度（#31・#35 の時点）。遅さが問題になったら、Nix のキャッシュの導入を別に検討する
- 採用理由: `build` ジョブに含めると、E2E のためだけに `build` ジョブが重くなり、失敗の原因も切り分けにくくなる。手動・定期の実行だけにすると、壊れたことに PR の時点で気づけない

#### Playwright MCP

- `@playwright/mcp` を devDependencies に版を固定して追加する（`minimumReleaseAge` を満たす 0.0.82。Playwright 1.64 の alpha 版に依存するが、`@playwright/test` とは別に入る）。README の `npx @playwright/mcp@latest` は ADR 0006 の審査を通らないため使わない
- 起動用のスクリプト（`e2e/mcp-server.sh`）が、E2E の devShell の Chromium と、ビルドの出力（`.output/chrome-mv3/`）の絶対パスで設定ファイルを組み立て、`pnpm exec` で Playwright MCP を起動する。`--load-extension` 等の Chromium の引数は CLI のオプションでは渡せないため、設定ファイルの `launchOptions.args` に書く。`.mcp.json` からは `nix develop .#e2e --command e2e/mcp-server.sh` で呼ぶ。`.mcp.json` のサーバーは、Claude Code で各自が承認してから使える
- `--isolated` は使えない。`launch()` と `newContext()` で起動し、拡張機能が無効なコンテキストになるため、拡張機能のページが `ERR_BLOCKED_BY_CLIENT` で開けない。代わりに、起動ごとの一時ディレクトリ（設定ファイルも置く）を永続コンテキストのプロフィール（`userDataDir`）にし、スクリプトの終了時に消す。`userDataDir` を渡さないと `~/.cache/ms-playwright-mcp/` の worktree ごとのプロフィールに状態が残る。このため、ルール等の状態は `browser_close` の後も残り、Playwright MCP を起動し直すと消える。終了時に消すため、スクリプトは Playwright MCP を `exec` せず子プロセスとして起動する
- 既定はヘッドレス。表示して見たいときは `TABHERD_MCP_HEADED=1` で切り替える
- 拡張機能の ID は、パッケージ化していない拡張機能ではフォルダの絶対パスから決まる（SHA-256 の先頭 32 桁を a〜p に置き換えたもの）。エージェントが ID を得られるよう、ID を表示するスクリプト（`pnpm e2e:extension-id`、`e2e/mcp-extension-id.sh`）を用意する。`e2e/mcp-server.sh` もこれでオリジンの制限に使う ID を求める
- Playwright MCP には個々のツールを無効にするオプションがないため、任意のコードを Playwright のサーバーのプロセスで実行する `browser_run_code_unsafe` は、`.claude/settings.json` の `permissions.deny` で使えないようにする。ページの中で JavaScript を実行する `browser_evaluate` は、拡張機能のページから `chrome.*` を呼んで状態を確かめるのに使うため許す
  - この拒否は Claude Code の権限設定によるもので、Playwright MCP のサーバーではこのツールは有効なまま。`deny` に入れたツールは Claude Code のツールの一覧にも載らない。`.claude/settings.json` を読まないエージェント（Codex 等）にこのサーバーを登録すると呼べてしまうため、登録しない
- 開くオリジンは、設定ファイルの `network.allowedOrigins`（`--allowed-origins` と同じ）で `http://127.0.0.1:*` と拡張機能のページに絞る。README のとおりこれはセキュリティの境界ではなく、リダイレクトにも効かない。エージェントが意図せず外部のサイトを開かないようにするためのもの
  - 制限はコンテキストの `route` で行われ、各項目は `new URL()` の origin からグロブ（`<origin>/**`）に変換される。`http(s)://<host>:*` の形だけはポートを任意にできる
  - `chrome-extension://<ID>` と書くと origin が `"null"` になり、ホスト名とみなされて `*://chrome-extension://<ID>/**` という一致しないグロブになる。このとき `popup.html` の文書は開けるが、JS・CSS が遮断されて何も表示されない
  - そこで拡張機能はホスト名（ID）だけを書く。`*://<ID>/**` として照合され、拡張機能のページとそのサブリソースが開ける
  - `https://example.com` と `http://localhost:<port>` が `ERR_BLOCKED_BY_CLIENT` で開けず、`http://127.0.0.1:<port>` と拡張機能のページが開けることを確かめた
- ビルドは自動で行わない。エージェントは `pnpm build` の後に Playwright MCP を使う。読み込み済みの拡張機能はビルドし直しても更新されないため、`browser_close` で閉じて次のツールの呼び出しで起動し直す
- Playwright MCP の出力（スナップショット等。`browser_navigate` の結果にはスナップショットが含まれずファイルに保存される）は、リポジトリの直下の `.playwright-mcp/` にでき、Git の管理から外す

#### ADR

上の判断（ツール・ブラウザの供給元・依存の置き場所・CI での実行・Playwright MCP）を、1つの ADR（`docs/adr/0013-...`）にまとめて残す。どれも「拡張機能をブラウザで確かめる手段」という1つの問題に対する判断で、互いに前提になっているため。

### Risks / Trade-offs

- [nixpkgs の更新で Chromium の版が上がり、`@playwright/test` と CDP の互換性が崩れる] → Renovate の nixpkgs の更新 PR で E2E のジョブが落ちるので、そこで `@playwright/test` の版を揃える
- [CI の E2E のジョブが、毎回 Chromium を取得する（今は全体で 45〜80 秒程度）] → 当面は許容する。テストが増えて遅くなったら Nix のキャッシュを別に検討する
- [Playwright MCP は 1.0 前で更新が頻繁、かつ alpha 版の Playwright に依存する] → 版を固定し、Renovate の更新で壊れたら固定を戻す。E2E テストは Playwright MCP に依存しないため、壊れても CI は止まらない
- [`--allowed-origins` はセキュリティの境界ではない] → 任意のコードを実行するツールは権限設定で禁じる。Playwright MCP を使うのは、ローカルのサーバーと拡張機能のページを確かめるときに限る
- [テストごとに Chromium を起動するため、テストが増えると遅くなる] → 必要になったらワーカー単位の起動に切り替える
- [ヘッドレスの Chromium と本物のポップアップでは、サイズや表示が異なりうる] → 本物のポップアップは引き続き手で確かめる（Non-Goals）

### Migration Plan

新しく追加するだけで、既存の開発の流れ（既定の devShell・`build` ジョブ）は変わらない。やめるときは、`devShells.e2e`・`e2e/`・`e2e` ジョブ・`.mcp.json` を消し、devDependencies を外す。
