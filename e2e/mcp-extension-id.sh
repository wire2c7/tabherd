#!/usr/bin/env bash
# ビルドの出力（.output/chrome-mv3/）を読み込んだときの拡張機能の ID を表示する。
# Playwright MCP で chrome-extension://<ID>/popup.html 等を開くのに使う。
# パッケージ化していない拡張機能の ID は、フォルダの絶対パス（シンボリックリンクを解決したもの）の
# SHA-256 の先頭 32 桁（16 進）を a〜p に置き換えたもの。worktree ごとに異なる
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd -P)"
printf '%s' "${repo_root}/.output/chrome-mv3" |
  sha256sum |
  cut -c1-32 |
  tr '0-9a-f' 'a-p'
