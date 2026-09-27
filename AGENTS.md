# AGENTS.md

このファイルはAIコーディングエージェント（Claude Code、Codex等）向けのプロジェクト指示書です。
人間向けの説明は [README.md](README.md) を参照してください。

## プロジェクト概要

<!-- TODO: テンプレートから作成したら、このプロジェクトの目的・構成・主要な技術スタックを記述する -->

`AGENTS.md`・`.claude/`・`README.md` 等のドキュメントに対して、ソースコード・設定ファイルがSSoT（信頼できる唯一の情報源）である。
食い違いがあれば、実装ではなくドキュメントを修正する。

## 開発環境

- 開発ツールはすべてNix devShell（`flake.nix` の `devShells.default`）で管理する。グローバルインストール（`npm i -g`、`pip install --user`、`brew install` 等）はしない
- ツールの追加は `.claude/skills/add-devshell-tool/SKILL.md` の手順に従う
- コマンドは devShell 内で実行する。devShell の環境が読み込まれていない場合は `nix develop --command bash -c '...'` で包む
- 新規ファイルは `git add` するまで flake（`nix build` / `nix flake check` / `nix fmt` 等）から見えない
- ローカル用の環境変数は `.env` に書く（雛形は `.env.example`）

## コマンド

- `nix flake check`: 全チェック（`treefmt` によるフォーマット検査を含む）
- `treefmt`: 全ファイルの整形・lint（devShell 外では `nix fmt`。どちらも `flake.nix` の `treefmt` の設定で実行される）
- `prek run --all-files`: `.pre-commit-config.yaml` のフックをリポジトリ全体に実行

<!-- TODO: ビルド・テスト・起動コマンドを追記する -->

## アーキテクチャ

- `flake.nix` — `flake-parts` による単一の flake。フォーマッタ・リンタは `treefmt-nix` の `treefmt.programs` に集約し、`nix flake check` にも組み込まれる
- CI の処理と Renovate の共通設定は [wire2c7/workflows](https://github.com/wire2c7/workflows) で管理しており、このリポジトリはそれを参照するだけ。CI の内容を変える場合はそちらを変更する
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
