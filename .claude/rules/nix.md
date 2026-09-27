---
paths:
  - "**/*.nix"
---

# Nix 規約

`*.nix` は [Nixpkgs CONTRIBUTING.md](https://github.com/NixOS/nixpkgs/blob/master/CONTRIBUTING.md) のコーディング規約に従う。

## 主な規約（ツールでは検出されない観点）

- 変数名は `lowerCamelCase`、ファイル名は kebab-case
- 関数引数はキャッチオール（`args: with args; ...` や不要な末尾の `...`）を避け、必要な引数を明示的に列挙する。ただし、呼び出し側が宣言外の引数を渡してくる場合（flake-parts の `perSystem`、モジュール関数、flake の `outputs` 等）は `...` が必須
- 複数の値を要求しつつ一部の引数だけ必要とする関数は `@`-パターンを使う
- 不要な文字列変換をしない（`{ tag = version; }` であって `{ tag = "${version}"; }` ではない）
- 条件によるリスト構築は `null`/空リストを返す条件式ではなく `lib.optional(s)` を使う
- `''` 文字列の中でシェルの `${var}` を書く場合は `''${var}` とエスケープする（エスケープしないとNixの補間になる）

## 自動チェック

- 整形: `nixfmt`（`treefmt`）
