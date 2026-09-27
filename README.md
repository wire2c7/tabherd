# template-repo

新規リポジトリ用のGitHubテンプレートです。次のものが最初からセットアップされた状態で開発を始められます。

- **Nix devShell**（flake-parts）による再現可能な開発環境
- **treefmt** によるフォーマッタの集約（`nix fmt`）
- **prek** によるGitフック
- **GitHub Actions** によるCI
- **Renovate** による依存関係の自動更新
- **AGENTS.md** によるAIコーディングエージェント向けの指示

## 含まれるもの

| ファイル | 役割 |
| --- | --- |
| `flake.nix` / `flake.lock` | devShell・treefmt・`nix flake check` の定義 |
| `.envrc.example` | direnv の設定の雛形 |
| `.env.example` | ローカル用環境変数の雛形 |
| `.pre-commit-config.yaml` | prek のフック定義 |
| `.commitlintrc.yaml` | コミットメッセージの検証ルール |
| `.editorconfig` | エディタ共通の書式設定 |
| `.github/workflows/ci.yaml` | CI（[wire2c7/workflows](https://github.com/wire2c7/workflows) の共有ワークフローを呼び出す） |
| `.github/renovate.json5` | Renovate の設定（wire2c7/workflows の共有設定を継承） |
| `.github/pull_request_template.md` / `.github/ISSUE_TEMPLATE/` | PR・Issue のテンプレート |
| `AGENTS.md` | AIエージェント向けのプロジェクト指示（Claude Code もこれを読む） |
| `.claude/` | Claude Code のプロジェクト設定・ファイル種別ごとの規約・スキル |

## 前提

- [Nix](https://nixos.org/)（flakes 有効）
- [direnv](https://direnv.net/) と [nix-direnv](https://github.com/nix-community/nix-direnv)（任意・推奨）

## 使い方

1. GitHubで **Use this template** から新規リポジトリを作成し、clone する
2. 開発環境に入る

   ```sh
   # direnv を使う場合
   cp .envrc.example .envrc
   cp .env.example .env   # 環境変数が必要な場合
   direnv allow

   # direnv を使わない場合
   nix develop
   ```

   devShell に入ると prek の Gitフックが自動でインストールされます。
3. 下のチェックリストに沿ってプロジェクト固有の設定をする

## テンプレートから作成した後のチェックリスト

- [ ] `flake.nix` の `description` を変更する
- [ ] `flake.nix` の `devShells.default.packages` に言語ツールチェーンを追加する
- [ ] `flake.nix` の `treefmt.programs` に使用言語のフォーマッタを追加する
- [ ] `.gitignore` に言語固有の除外パターンを追加する
- [ ] `AGENTS.md` の TODO（プロジェクト概要、ビルド・テストコマンド）を埋める
- [ ] CI にビルド・テストのステップを追加する
- [ ] リポジトリに [Renovate GitHub App](https://github.com/apps/renovate) をインストールする
- [ ] ブランチ保護で CI のステータスチェック `ci / check` を必須にする
- [ ] この README をプロジェクト用に書き換える

## よく使うコマンド

```sh
nix fmt                  # フォーマット
nix flake check          # フォーマット検査など flake のチェック
prek run --all-files     # 全ファイルに Gitフックを実行
nix flake update         # 依存の更新（通常は Renovate に任せる）
```
