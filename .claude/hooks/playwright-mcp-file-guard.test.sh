#!/usr/bin/env bash
# playwright-mcp-file-guard.sh のテスト。一時ディレクトリにプロジェクトを作り、
# ツールの入力ごとにフックの終了コード（0: 許す、2: 拒否する）を確かめる。
# prek のフックから実行される。
set -euo pipefail

hook="$(cd "$(dirname "$0")" && pwd -P)/playwright-mcp-file-guard.sh"
project="$(mktemp -d -t tabherd-file-guard-test.XXXXXX)"
trap 'rm -rf "${project}"' EXIT
project="$(realpath -- "${project}")"
failures=0

#######################################
# ツールの入力をフックに渡し、終了コードが期待どおりかを確かめる。
# Globals:
#   hook, project, failures
# Arguments:
#   期待する終了コード
#   tool_input の JSON（文字列の @ はプロジェクトのパスに置き換える）
#   追加で環境に渡す変数（任意。例: PATH=/nonexistent）
# Outputs:
#   失敗したときに内容を標準エラー出力に書く
#######################################
expect() {
  local want="$1" tool_input="${2//@/${project}}" got=0
  shift 2
  printf '{"cwd":"%s","tool_name":"mcp__playwright__browser_evaluate",' \
    "${project}" >"${project}/input.json"
  printf '"tool_input":%s}' "${tool_input}" >>"${project}/input.json"
  env CLAUDE_PROJECT_DIR="${project}" "$@" \
    "${BASH}" "${hook}" <"${project}/input.json" >/dev/null 2>&1 || got=$?
  if ((got != want)); then
    echo "失敗: ${tool_input}（期待 ${want}、実際 ${got}）" >&2
    failures=$((failures + 1))
  fi
}

mkdir -p "${project}/.playwright-mcp" "${project}/outside"
ln -s ../AGENTS.md "${project}/.playwright-mcp/link.json"
ln -s .. "${project}/.playwright-mcp/up"
ln -s .playwright-mcp/up "${project}/sub"

# 許す
expect 0 '{"function":"() => 1"}'
expect 0 '{"filename":""}'
expect 0 '{"filename":".playwright-mcp/a.json"}'
expect 0 '{"filename":"./.playwright-mcp//a.json"}'
expect 0 '{"filename":".playwright-mcp/new/dir/a.png"}'
expect 0 '{"filename":"@/.playwright-mcp/a.json"}'
expect 0 '{"filename":".playwright-mcp/x/../a.json"}'
expect 0 '{"paths":["@/.playwright-mcp/a.txt","@/.playwright-mcp/b.txt"]}'

# 外を指す
expect 2 '{"filename":"a.json"}'
expect 2 '{"filename":".claude/settings.json"}'
expect 2 '{"filename":".playwright-mcp/../AGENTS.md"}'
expect 2 '{"filename":".playwright-mcp"}'
expect 2 '{"filename":".playwright-mcpX/a.json"}'
expect 2 '{"filename":"/tmp/a.json"}'
expect 2 '{"paths":["@/.playwright-mcp/a.txt","@/.env"]}'

# シンボリックリンクを経由して外を指す
expect 2 '{"filename":".playwright-mcp/link.json"}'
expect 2 '{"filename":".playwright-mcp/up/a.json"}'
# 字句的に正規化すると外（サーバーはこちらに書く）
expect 2 '{"filename":"sub/../a.json"}'

# 調べられない
expect 2 '{"paths":"@/.env"}'
expect 2 '{"filename":".playwright-mcp/a.json"}' PATH=/nonexistent
printf 'not json' >"${project}/broken.json"
got=0
CLAUDE_PROJECT_DIR="${project}" "${BASH}" "${hook}" \
  <"${project}/broken.json" >/dev/null 2>&1 || got=$?
if ((got != 2)); then
  echo "失敗: 壊れた JSON（期待 2、実際 ${got}）" >&2
  failures=$((failures + 1))
fi

# .playwright-mcp/ 自体がシンボリックリンク
rm -rf "${project}/.playwright-mcp"
ln -s outside "${project}/.playwright-mcp"
expect 2 '{"filename":".playwright-mcp/a.json"}'

if ((failures > 0)); then
  echo "${failures} 件失敗しました" >&2
  exit 1
fi
