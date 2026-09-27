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

## アーキテクチャ

- `flake.nix` — `flake-parts` による単一の flake。フォーマッタ・リンタは `treefmt-nix` の `treefmt.programs` に集約し、`nix flake check` にも組み込まれる
- CI の共通の検査（`ci` ジョブ）と Renovate の共通設定は [wire2c7/workflows](https://github.com/wire2c7/workflows) で管理しており、このリポジトリはそれを参照するだけ。共通の検査を変える場合はそちらを変更する。このリポジトリ固有の整形・lint・型チェック・テスト・ビルドは `.github/workflows/ci.yaml` の `build` ジョブで実行する
- `entrypoints/` — WXT のエントリポイント。ファイル構成から `manifest.json` が生成される。manifest の追加項目（権限等）は `wxt.config.ts` に書く
- Oxfmt・Oxlint は `node_modules` を必要とするため、`nix flake check`（treefmt）ではなく prek のフックと CI の `build` ジョブで実行する。prek のフックは `pnpm exec` 経由のため、`node_modules` が無ければ pnpm が先に自動でインストールする（`ci` ジョブの prek もこれで動く）
- Node.js・pnpm は Nix devShell から供給する。`package.json` に `packageManager` を書かない（corepack や pnpm 自身のバージョン管理と二重管理になるため）
- `.pre-commit-config.yaml` — Gitフックのエントリポイント（prek）。フックはNix devShellのツールを使う（`language: system`）ため、devShell 外では動かない。devShell に入ると自動でインストールされる

## 規約

- コメント・ドキュメント・コミットメッセージは日本語で書く
- ファイル種別ごとの規約は `.claude/rules/*.md` にある（`paths` で対象ファイルを指定）。Claude Code 以外のエージェントも、該当するファイルを編集する前に読むこと
- 設定ファイルには原則ツールのデフォルトと異なる項目のみを書く。デフォルトと同じ値をあえて書く場合は、その理由をコメントで残す
- 変更は依頼された範囲に留め、無関係なリファクタリングを混ぜない

## コミット・PR

- [Conventional Commits](https://www.conventionalcommits.org/ja/) に従う。ルールは `.commitlintrc.yaml` を参照（commitlint で検証される）
- 1コミット1論理変更を基本とする。依存パッケージの追加（`flake.nix`）と、それを使う設定変更・ドキュメント更新は別コミットにする
- PRは `.github/pull_request_template.md` に沿って記述し、PRタイトルも Conventional Commits の形式にする
- `--no-verify` でフックを回避しない。フックが失敗したら原因を修正する

## 禁止事項

- シークレット（APIキー、トークン、秘密鍵等）をコミットしない（`.env` はGit管理外）
- `flake.lock` を手で編集しない
