#!/usr/bin/env bash
# PreToolUse(mcp__playwright__.*)フック: Playwright MCP のツールの filename が
# .playwright-mcp/ の外を指す呼び出しを拒否する。
# Playwright MCP は filename の書き込みを出力先と roots（リポジトリの直下）の中に許すため、
# browser_evaluate の戻り値等でリポジトリの任意のファイルを上書きできてしまう。
# 拒否するときは終了コード 2 で終わり、理由を標準エラー出力に出す。
set -euo pipefail

# jq が無いと filename を調べられないため、拒否する（許してしまうよりよい）
if ! command -v jq >/dev/null; then
  echo "jq が無いため Playwright MCP の呼び出しを確かめられません。devShell の中で Claude Code を起動してください" >&2
  exit 2
fi

input=$(cat)
filename=$(jq -r '.tool_input.filename // empty' <<<"${input}")
[[ -z ${filename} ]] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd' <<<"${input}")}"
allowed_dir="${project_dir}/.playwright-mcp"

# 相対パスは roots（リポジトリの直下）から解決される
case "${filename}" in
/*) path="${filename}" ;;
*) path="${project_dir}/${filename}" ;;
esac

# ./ と連続した / をまとめる
while [[ ${path} == *"/./"* || ${path} == *"//"* ]]; do
  path="${path//\/.\//\/}"
  path="${path//\/\//\/}"
done

# .. を含むパスは、正規化せずに拒否する
case "/${path}/" in
*/../*)
  echo "Playwright MCP の filename に .. は使えません: ${filename}" >&2
  exit 2
  ;;
esac

case "${path}" in
"${allowed_dir}"/*) exit 0 ;;
esac

echo "Playwright MCP の filename は .playwright-mcp/ の中だけを指せます（例: .playwright-mcp/result.json）: ${filename}" >&2
exit 2
