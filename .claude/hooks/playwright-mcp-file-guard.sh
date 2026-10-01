#!/usr/bin/env bash
# PreToolUse(mcp__playwright__.*)フック: Playwright MCP のツールの filename・paths が
# .playwright-mcp/ の外を指す呼び出しを拒否する。
# Playwright MCP はファイルの読み書きを出力先と roots（リポジトリの直下）の中に許すため、
# browser_evaluate の戻り値でリポジトリの任意のファイルを上書きしたり、
# browser_file_upload で任意のファイルをページに渡したりできてしまう。
# 拒否するときは終了コード 2 で終わり、理由を標準エラー出力に出す。
set -euo pipefail

#######################################
# 理由を出して呼び出しを拒否する。
# Arguments:
#   拒否する理由（複数の引数はそのままつなぐ）
# Outputs:
#   理由を標準エラー出力に書く
#######################################
deny() {
  printf '%s' "$@" >&2
  echo >&2
  exit 2
}

#######################################
# 途中で失敗したときも拒否する（終了コード 2 以外では、Claude Code は呼び出しを通す）。
#######################################
deny_on_failure() {
  local status=$?
  if ((status != 0 && status != 2)); then
    echo "Playwright MCP の呼び出しを確かめられないため拒否します" \
      "（終了コード ${status}）" >&2
    exit 2
  fi
}

#######################################
# サーバーと同じく、パスを字句的に正規化してからシンボリックリンクを解決する。
# Globals:
#   project_dir
# Arguments:
#   パス（相対パスは roots（リポジトリの直下）から解決される）
# Outputs:
#   解決したパスを標準出力に書く
#######################################
resolve() {
  local path="$1"
  [[ ${path} == /* ]] || path="${project_dir}/${path}"
  realpath -m -- "$(realpath -m -s -- "${path}")"
}

trap deny_on_failure EXIT

command -v jq >/dev/null ||
  deny "jq が無いため Playwright MCP の呼び出しを確かめられません。" \
    "devShell の中で Claude Code を起動してください"

input=$(cat)
project_dir="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd' <<<"${input}")}"
project_dir="$(realpath -m -- "${project_dir}")"
allowed_dir="${project_dir}/.playwright-mcp"

# .playwright-mcp/ 自体がシンボリックリンクだと、その先に読み書きできてしまう
[[ "$(resolve "${allowed_dir}")" == "${allowed_dir}" ]] ||
  deny ".playwright-mcp/ がシンボリックリンクのため拒否します"

# 空の filename はサーバーでも指定なしとして扱われる。
# プロセス置換の終了コードは set -e で拾えないため、wait で確かめる
mapfile -d '' files < <(
  jq --raw-output0 \
    '.tool_input | (.filename // empty), (.paths // [])[] | select(. != "")' \
    <<<"${input}"
)
wait "$!"

for file in "${files[@]}"; do
  case "$(resolve "${file}")" in
  "${allowed_dir}"/*) ;;
  *)
    deny "Playwright MCP のファイルは .playwright-mcp/ の中だけを指せます" \
      "（例: .playwright-mcp/result.json）: ${file}"
    ;;
  esac
done
