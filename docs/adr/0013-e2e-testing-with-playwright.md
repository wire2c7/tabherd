# 0013. E2E テストに Playwright と nixpkgs の Chromium を使い、E2E 用の devShell に分ける

- ステータス：Accepted
- 日付：2026-09-30
- 関連 Issue：#26

## コンテキスト

ブラウザの API を実際に呼ぶ部分（タブ・タブグループの操作、Service Worker のイベント）と設定画面の操作は、Vitest の単体テストで確かめられない。WXT の fake-browser は `tabGroups` に対応していないため、#13 ではこれらを手動の確認として扱い、確認の手順は 52 項目になった。拡張機能を読み込んだブラウザで自動で確かめる手段と、エージェントがブラウザを操作して確かめる手段が要る。

前提と制約:

- ブランドの Google Chrome は Chrome 137 以降 `--load-extension` を受け付けないため、Chromium を使う必要がある
- 開発ツールは Nix の devShell で管理している（AGENTS.md）。nixpkgs の Playwright のブラウザは、全ブラウザで約 2.2 GiB、Chromium だけで約 690 MiB（依存を含む）あり、Linux 向けのみ
- 依存パッケージは pnpm の `minimumReleaseAge`・`trustPolicy` で審査している（ADR 0006）
- #13 の一時的な検証で、nixpkgs の Chromium に拡張機能を読み込ませて Playwright で操作できること、Playwright MCP でも同じ Chromium で拡張機能を読み込めることを確かめた

## 検討した選択肢

### ツール

- **Playwright（`@playwright/test`）**：拡張機能の読み込み・Service Worker の取得・HTML5 Drag and Drop が動くことを確かめた。テストランナー・fixture・失敗時のトレースが揃い、nixpkgs に対応する Chromium がある
- **Puppeteer**：Chrome 専用で軽い。テストランナーを別に用意する必要があり、nixpkgs でブラウザの版を揃える手段も Playwright ほど整っていない
- **E2E を入れず、手動の確認のままにする**：依存は増えないが、52 項目の確認を毎回手で行う手間と、確認漏れの危険が大きい

### ブラウザの供給元

- **nixpkgs の Chromium**：Nix で管理でき、NixOS 等でも動く
- **Playwright が npm 経由でダウンロードするブラウザ**（`playwright install`）：準備は簡単だが、Nix の管理から外れ、環境によっては共有ライブラリが足りず動かない

### 依存の置き場所

- **E2E 用の devShell に分ける**：普段の `nix develop` と CI の `build` ジョブは重くならない。E2E を実行するときだけ別の devShell に入る
- **既定の devShell に含める**：準備は簡単だが、普段の `nix develop` と CI のすべてのジョブで約 690 MiB を取得する

### CI での実行

- **別のジョブで PR ごとに実行する**：`build` ジョブと並列に動き、失敗の原因も切り分けやすい。Chromium の取得の分、ジョブは重い
- **`build` ジョブに含める**：ジョブは増えないが、`build` ジョブが重くなり、失敗の原因も分かりにくくなる
- **手動・定期の実行だけにする**：PR は速いが、壊れたことに PR の時点で気づけない

### エージェントがブラウザを操作して確かめる手段

- **Playwright MCP を入れる**：エージェントが画面の状態（アクセシビリティツリー）を読み、操作し、拡張機能のページから `chrome.*` を呼んで確かめられる。1.0 前で更新が頻繁で、任意のコードを実行するツール（`browser_run_code_unsafe`）もある。個々のツールを無効にするオプションはない
- **入れない**：エージェントが確かめるには、その都度スクリプトを書く必要がある

## 決定

- E2E テストは Playwright（`@playwright/test`）で書き、nixpkgs の Chromium に拡張機能を読み込ませて実行する。Chromium の場所は環境変数で渡し、Playwright の `executablePath` に使う。`PLAYWRIGHT_BROWSERS_PATH` は使わない（npm と nixpkgs の Playwright の版が完全に一致しないとブラウザを見つけられず、両方を常に同時に更新する必要が出るため）
- Chromium は Linux のみの E2E 用の devShell（`devShells.e2e`）にだけ入れ、既定の devShell には入れない。Chromium の component だけを使い、全ブラウザは入れない
- CI では `e2e` ジョブを `build` ジョブとは別に、PR ごとに実行する
- Playwright MCP を入れる。版を固定して devDependencies に加え（`npx @playwright/mcp@latest` は ADR 0006 の審査を通らないため使わない）、E2E の devShell の Chromium で拡張機能を読み込んで起動する。`browser_run_code_unsafe` は Claude Code の権限設定で使えないようにする。開くオリジンの制限（`--allowed-origins`）は、エージェントが意図せず外部のサイトを開かないための補助であり、セキュリティの境界としては扱わない
- E2E テストで確かめられない既知の制約（ツールバーから開く本物のポップアップ等）は、手で確かめる手順を付けた `test.fixme` のテストとして残す

## 結果

- 拡張機能の振る舞いを、拡張機能を読み込んだ Chromium で PR ごとに自動で確かめられる
- 普段の `nix develop` と `build` ジョブの依存は増えない。E2E は `nix develop .#e2e` の中で実行する必要がある
- macOS では E2E テストを実行できない
- CI の `e2e` ジョブは、Nix のキャッシュを使っていないため、毎回 Chromium の取得に時間がかかる。遅さが問題になったら、Nix のキャッシュの導入を別に検討する
- nixpkgs の更新で Chromium の版が上がると、`@playwright/test` との CDP の互換性が崩れうる。その場合は `@playwright/test` の版を nixpkgs の `playwright-driver` に揃える
- Playwright MCP は更新で壊れうるが、E2E テストは Playwright MCP に依存しないため、CI は止まらない
