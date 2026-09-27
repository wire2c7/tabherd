# 0005. JS/TS 向けのツールを package.json で管理する

- ステータス：Accepted
- 日付：2026-09-28

## コンテキスト

テンプレート（wire2c7/template-repo）では、開発ツールはすべて Nix devShell で管理し、フォーマッタ・リンタは treefmt にまとめて `nix flake check` で検査する方針だった。

TabHerd では、lint に Oxlint、整形に Oxfmt を使う。最初は nixpkgs の oxlint・oxfmt を treefmt に組み込んだ。

## 検討した選択肢

- **Nix（treefmt）で管理する**：`nix flake check` ですべてのファイルを検査でき、テンプレートの方針にも合う。一方、次の問題がある
  - VS Code の Oxc 拡張は `node_modules` の oxlint・oxfmt を優先して使うため、エディタと CI で結果が食い違うおそれがある
  - nixpkgs は npm より更新が遅れる（検討時点で oxfmt は npm が 0.70、nixpkgs が 0.68）
  - 型情報を使う lint（`oxlint-tsgolint`）や oxlint の JS プラグインは、`node_modules` からの読み込みが前提になっている
- **`package.json` の `devDependencies` で管理する**：エディタ拡張、Renovate の更新 PR、`pnpm-lock.yaml` でバージョンを揃えられる。代わりに、Nix のビルド環境には `node_modules` がないため、`nix flake check` では JS/TS を検査できない

## 決定

- Node.js と pnpm は Nix devShell から供給する
- JS/TS 向けのツール（Oxlint・Oxfmt・TypeScript・Vitest など）は `package.json` の `devDependencies` で管理する
- Oxfmt・Oxlint は prek のフック（`pnpm exec` 経由）と CI の `build` ジョブで実行する。treefmt は Nix・シェル・Markdown を担当する
- `package.json` に `packageManager` は書かない。corepack や pnpm 自身のバージョン管理と、Nix での管理が二重になるのを避けるため

## 結果

- エディタ・prek・CI で同じバージョンの oxlint・oxfmt が動く
- `nix flake check` だけでは JS/TS の整形・lint を検査できない
- prek のフックは、`node_modules` がないと pnpm が先に自動でインストールする。複数のプロセスで同時にインストールすると競合して失敗するため（`ERR_PNPM_LOCKFILE_RENAME_FILE`）、フックに `require_serial: true` を指定している
