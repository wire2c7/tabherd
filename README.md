# TabHerd - Auto Tab Groups

タブグループを自動で管理する Chrome 拡張機能です。

## 技術スタック

- [WXT](https://wxt.dev/)（Vite 8）/ TypeScript 7 / [Preact](https://preactjs.com/)
- pnpm / Oxlint / Oxfmt / Vitest
- 開発環境は Nix devShell（flake-parts）で管理

## 前提

- [Nix](https://nixos.org/)（flakes 有効）
- [direnv](https://direnv.net/) と [nix-direnv](https://github.com/nix-community/nix-direnv)（任意・推奨）

## セットアップ

```sh
# direnv を使う場合
cp .envrc.example .envrc
direnv allow

# direnv を使わない場合
nix develop

pnpm install
```

devShell に入ると prek の Gitフックが自動でインストールされます。

## 開発

```sh
pnpm dev         # 拡張機能を読み込んだ Chrome を起動（変更は自動で反映）
pnpm build       # 本番ビルド（.output/chrome-mv3/）
pnpm zip         # Chrome ウェブストア提出用の zip を作成
pnpm fmt         # 整形（Oxfmt）
pnpm lint        # lint（Oxlint）
pnpm typecheck   # 型チェック
pnpm test        # テスト
treefmt          # Nix・シェル・Markdown の整形・lint
nix flake check  # フォーマット検査など flake のチェック
```

`pnpm build` の出力を手動で読み込む場合は、`chrome://extensions` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から `.output/chrome-mv3/` を選択します。
