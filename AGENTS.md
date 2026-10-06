# AGENTS.md

このファイルはAIコーディングエージェント（Claude Code、Codex等）向けのプロジェクト指示書です。
人間向けの説明は [README.md](README.md) を参照してください。

## プロジェクト概要

TabHerd（表示名「TabHerd - Auto Tab Groups」）は、タブグループを自動で管理する Chrome 拡張機能（Manifest V3）。
WXT（Vite 8）+ TypeScript 7 + Preact で構成し、パッケージ管理は pnpm、lint・整形は Oxlint・Oxfmt、テストは Vitest を使う。

`AGENTS.md`・`.claude/`・`README.md` 等のドキュメントに対して、ソースコード・設定ファイルがSSoT（信頼できる唯一の情報源）である。
食い違いがあれば、実装ではなくドキュメントを修正する。

## 開発環境

- 開発ツールは Nix devShell（`flake.nix` の `devShells.default`）で管理する。ただし JS/TS 向けのツール（Oxlint・Oxfmt・TypeScript・Vitest 等）は `package.json` の `devDependencies` で管理する（エディタ拡張・Renovate とバージョンを揃えるため）。グローバルインストール（`npm i -g`、`pip install --user`、`brew install` 等）はしない
- devShell へのツールの追加は `.claude/skills/add-devshell-tool/SKILL.md` の手順に従う
- npm パッケージのバージョンは完全一致で固定する（`pnpm-workspace.yaml` の `savePrefix`）。追加は `pnpm add` で行い、`package.json` を手で書き換えない
- `pnpm-workspace.yaml` の `minimumReleaseAge` により、公開から3日未満のバージョンは入れられない（`ERR_PNPM_NO_MATURE_MATCHING_VERSION`）。`minimumReleaseAgeExclude` で回避せず、古いバージョンを指定する。`trustPolicy` の違反（`TRUST_DOWNGRADE`）は公開者・provenance の履歴を調べてから、誤検知と判断できた場合のみ版を限定して `trustPolicyExclude` に加える
- コマンドは devShell 内で実行する。devShell の環境が読み込まれていない場合は `nix develop --command bash -c '...'` で包む
- 新規ファイルは `git add` するまで flake（`nix build` / `nix flake check` / `nix fmt` 等）から見えない
- ローカル用の環境変数は `.env` に書く（雛形は `.env.example`）

## コマンド

- `nix flake check`: 全チェック（`treefmt` によるフォーマット検査を含む）
- `treefmt`: Nix・シェル・Markdown の整形・lint（devShell 外では `nix fmt`。どちらも `flake.nix` の `treefmt` の設定で実行される）
- `prek run --all-files`: `.pre-commit-config.yaml` のフックをリポジトリ全体に実行
- `pnpm install`: 依存のインストール。postinstall の `wxt prepare` が `.wxt/`（型定義・`tsconfig`）を生成するため、型チェックやエディタの補完より先に実行する
- `pnpm dev` / `pnpm build` / `pnpm zip`: 開発サーバー（拡張機能を読み込んだブラウザを起動）/ 本番ビルド（`.output/`）/ ストア提出用 zip の作成
- `pnpm fmt` / `pnpm fmt:check`: JS/TS・JSON・YAML 等の整形 / 整形の検査（Oxfmt）
- `pnpm lint`: lint（Oxlint）
- `pnpm typecheck`: 型チェック（`tsc -b`）
- `pnpm test`: テスト（Vitest）
- `nix develop .#e2e --command pnpm e2e`: E2E テスト（Playwright）。Chromium は E2E 用の devShell（Linux のみ）にだけあり、既定の devShell では実行できない
- `pnpm e2e:extension-id`: Playwright MCP で読み込む拡張機能の ID の表示。ID はフォルダの絶対パスから決まるため、worktree ごとに異なる

## アーキテクチャ

- `flake.nix` — `flake-parts` による単一の flake。フォーマッタ・リンタは `treefmt-nix` の `treefmt.programs` に集約し、`nix flake check` にも組み込まれる
- CI の共通の検査（`ci` ジョブ）と Renovate の共通設定は [wire2c7/workflows](https://github.com/wire2c7/workflows) で管理しており、このリポジトリはそれを参照するだけ。共通の検査を変える場合はそちらを変更する。このリポジトリ固有の整形・lint・型チェック・テスト・ビルドは `.github/workflows/ci.yaml` の `build` ジョブで実行する
- `openspec/` — OpenSpec で管理する Spec。`.claude/skills/openspec-*`・`.claude/commands/opsx/`・`.agents/skills/openspec-*` は `openspec init` / `openspec update` の生成物のため、手で編集しない
- `entrypoints/` — WXT のエントリポイント。ファイル構成から `manifest.json` が生成される。manifest の追加項目（権限等）は `wxt.config.ts` に書く
  - エントリポイントになるのは直下のファイルと `<名前>/index.*` だけで、`<名前>/` のほかのファイルはならない。WXT による API の実装は `entrypoints/platform/` に置く
- WXT・Preact・LogTape をいつでも置き換えられるよう、使えるディレクトリを分けている（ADR 0021）。WXT は `entrypoints/`、Preact は `components/` と `entrypoints/`、LogTape は `utils/logging/setup.ts` だけで使う。`utils/` はブラウザの API（タブ・ストレージ）をインターフェースとして定義し、エントリポイントが WXT による実装を引数・props で渡す
  - 違反は `pnpm lint`（`.oxlintrc.jsonc` の `overrides` の `no-restricted-imports`）で検出される。`utils/`・`components/` で新しいパッケージを使うには、そこに許可を加える
  - WXT の自動インポートは無効（`wxt.config.ts` の `imports: false`）。WXT の API も import して使う
- Oxfmt・Oxlint は `node_modules` を必要とするため、`nix flake check`（treefmt）ではなく prek のフックと CI の `build` ジョブで実行する。prek のフックは `pnpm exec` 経由のため、`node_modules` が無ければ pnpm が先に自動でインストールする（`ci` ジョブの prek もこれで動く）
- Node.js・pnpm は Nix devShell から供給する。`package.json` に `packageManager` を書かない（corepack や pnpm 自身のバージョン管理と二重管理になるため）
- `.pre-commit-config.yaml` — Gitフックのエントリポイント（prek）。フックはNix devShellのツールを使う（`language: system`）ため、devShell 外では動かない。devShell に入ると自動でインストールされる
- `.mcp.json` の Playwright MCP — E2E の devShell の Chromium に `.output/chrome-mv3/` を読み込ませて操作する（起動は `e2e/mcp-server.sh`）
  - ビルドは自動で行わない。`pnpm build` の後に使い、ビルドし直したら `browser_close` で閉じる（読み込み済みの拡張機能は更新されず、次のツールの呼び出しで起動し直す）
  - 拡張機能のページは `chrome-extension://<pnpm e2e:extension-id の出力>/popup.html` 等で開く。開けるのは `http://127.0.0.1` と拡張機能のページだけ
  - `browser_navigate` の結果にはスナップショットが含まれない（ファイルに保存される）ため、要素の ref は `browser_snapshot` で得る
  - ルール等の状態はブラウザを閉じても残り、Playwright MCP を起動し直すと消える
  - ツールの `filename`・`paths` に指定できるのは `.playwright-mcp/` の中だけ。外を指す呼び出しは PreToolUse フックで拒否される（ADR 0015）
  - 任意のコードを実行する `browser_run_code_unsafe` は `.claude/settings.json` の `permissions.deny` で禁じているだけで、サーバーでは有効なまま（ADR 0013）。deny のルールとフックは `.mcp.json` のサーバー名に結び付くため、別の名前で登録しない。Claude Code 以外のエージェント（Codex 等）は `.claude/settings.json` を読まないため、登録する場合は、そのエージェントでこのツールとファイルの読み書き先を制限する方法を決めてここに書いてから登録する

## 規約

- コメント・ドキュメント・コミットメッセージは日本語で書く
- ファイル種別ごとの規約は `.claude/rules/*.md` にある（`paths` で対象ファイルを指定）。Claude Code 以外のエージェントも、該当するファイルを編集する前に読むこと
- 設定ファイルには原則ツールのデフォルトと異なる項目のみを書く。デフォルトと同じ値をあえて書く場合は、その理由をコメントで残す
- 変更は依頼された範囲に留め、無関係なリファクタリングを混ぜない
- 設計判断（技術の採用・不採用、構成・運用方針の変更等）をしたら、`docs/adr/` に ADR を追加する（書き方は `.claude/rules/adr.md`）
- 拡張機能のコードで使う API（JavaScript・CSS・拡張機能の API）は、`wxt.config.ts` の `minimum_chrome_version` の Chrome で使えるものに限る。Vite は構文を変換するが API は補わず、検査する仕組みも無い。新しい API が要るときは、その変更で最低版を上げて ADR を書く（`docs/adr/0019-minimum-chrome-version.md`）

## 作業の進め方

- 作業は Issue（範囲と受入条件）→ Spec（OpenSpec で、何を・どうやって作るか）→ 実装の順に進め、判断を下したら ADR を書く。役割の分け方は `docs/adr/0009-issue-spec-adr-workflow.md` を参照
- Issue は1つの PR で閉じられる粒度にする。大きい場合は親 Issue を作り、子 Issue を Sub-issue として紐付ける
- Spec は実装と食い違ったら実装を正として直す。背景と受入条件は Issue に書き、Spec からは Issue 番号を参照する
- PR の宛先は Stacked PR でも `develop` にする（`Closes #N` はデフォルトブランチへのマージでしか効かない）

## ブランチ・マージ

- `main` はリリース済みの状態、`develop`（デフォルトブランチ）は開発の統合先。どちらにも直接 push しない
- 作業ブランチは `develop` から切り、PR で `develop` にマージする。リリースは `develop` → `main` の PR で行う
- hotfix は `main` から切って `main` へ PR し、マージ後に `main` → `develop` の PR で取り込む
- 作業ブランチ名は `<type>/<Issue番号>-<説明>`（`type` は Conventional Commits の type、説明は英小文字の kebab-case。例: `feat/12-auto-grouping`）。作業前に Issue を作る。Renovate が作るブランチ（`renovate/`）は対象外
- マージはマージコミットのみ（スカッシュ・リベースはリポジトリ設定で無効）。PR 内のコミットがそのまま `develop`・`main` の履歴に残るため、PR を出す前にコミットを整理する

## コミット・PR

- [Conventional Commits](https://www.conventionalcommits.org/ja/) に従う。ルールは `.commitlintrc.yaml` を参照（commitlint で検証される）
- 1コミット1論理変更を基本とする。依存パッケージの追加（`flake.nix`）と、それを使う設定変更・ドキュメント更新は別コミットにする
- PRは `.github/pull_request_template.md` に沿って記述し、PRタイトルも Conventional Commits の形式にする（リポジトリ設定により、PR のタイトル・本文がマージコミットのメッセージになるため）
- `--no-verify` でフックを回避しない。フックが失敗したら原因を修正する
- コミット・PR・Issue の本文やエージェントへの依頼文をシェルのヒアドキュメントで渡すときは、区切りをクォートする（`<<'EOF'`）。クォートしないと、本文中のバッククォートや `$` がシェルに展開され、コマンドとして実行される

## 禁止事項

- シークレット（APIキー、トークン、秘密鍵等）をコミットしない（`.env` はGit管理外）
- `flake.lock` を手で編集しない
