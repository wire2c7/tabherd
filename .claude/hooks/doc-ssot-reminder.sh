#!/usr/bin/env bash
# PostToolUse(Edit|Write)フック: ドキュメントを編集した際、実装とのSSoT整合性を
# 確認するようClaudeに非ブロッキングで気づかせる。
set -euo pipefail

# jq が無い環境ではリマインドせずに終了する（フックの失敗で作業を妨げない）
command -v jq >/dev/null || exit 0

input=$(cat)
file_path=$(jq -r '.tool_input.file_path // empty' <<<"${input}")

case "${file_path}" in
*/AGENTS.md | */README.md | */.claude/*) ;;
*) exit 0 ;;
esac

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "このファイルはドキュメントであり、ソースコード・設定ファイルがSSoT。このタスクを終える前に、記述が実際のコード・設定・リポジトリの現状と食い違っていないか、参照先の内容を重ねて書いていないか確認すること（.claude/rules/docs.md）。"
  }
}'
