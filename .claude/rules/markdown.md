---
paths:
  - "**/*.md"
---

# Markdown 規約

`*.md` は [Google Markdown Style Guide](https://google.github.io/styleguide/docguide/style.html) に従う。lint・整形は rumdl（設定は `.rumdl.toml`）に任せる。

## 主な規約（ツールでは検出されない観点）

- 表は整った表形式データにのみ使い、それ以外はリスト・見出しで表現する
- 図は画像ではなく Mermaid で書く（GitHub 上で描画され、差分をレビューできるため）

## 自動チェック

- lint・整形: `rumdl`（`treefmt`）
