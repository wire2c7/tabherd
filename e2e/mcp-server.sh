#!/usr/bin/env bash
# E2E の devShell の Chromium に、ビルドの出力（.output/chrome-mv3/）を読み込ませる設定で
# Playwright MCP を起動する。.mcp.json から `nix develop .#e2e --command` 経由で呼ばれる。
# 引数は Playwright MCP にそのまま渡す。
# 標準出力は MCP の通信に使うため、ほかの出力は標準エラー出力に出す。
# TABHERD_MCP_HEADED=1 のときはブラウザを表示する（既定はヘッドレス）
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
repo_root="$(dirname "${script_dir}")"
extension_dir="${repo_root}/.output/chrome-mv3"

if [[ -z ${TABHERD_E2E_CHROMIUM:-} ]]; then
  echo "TABHERD_E2E_CHROMIUM がありません。" \
    "nix develop .#e2e --command e2e/mcp-server.sh で起動してください" >&2
  exit 1
fi
if [[ ! -d ${extension_dir} ]]; then
  # ブラウザはツールを最初に呼んだときに起動するため、それまでにビルドすればよい
  echo "${extension_dir} がありません。" \
    "Playwright MCP を使う前に pnpm build でビルドしてください" >&2
fi

headless=true
if [[ ${TABHERD_MCP_HEADED:-} == 1 ]]; then
  headless=false
fi

# 設定ファイルとプロフィールを起動ごとの一時ディレクトリに置き、終了時に消す。
# --isolated は launch() + newContext() で起動し、拡張機能のページが開けないため使えない。
# userDataDir を渡さないと ~/.cache/ms-playwright-mcp/ のプロフィールに状態が残る
work_dir="$(mktemp -d -t tabherd-playwright-mcp.XXXXXX)"
trap 'rm -rf "${work_dir}"' EXIT

# 拡張機能を読み込む引数（--load-extension 等）は CLI のオプションでは渡せないため、
# 設定ファイルに書く
jq -n \
  --arg chromium "${TABHERD_E2E_CHROMIUM}" \
  --arg extension "${extension_dir}" \
  --arg profile "${work_dir}/profile" \
  --argjson headless "${headless}" \
  '{
    browser: {
      browserName: "chromium",
      userDataDir: $profile,
      launchOptions: {
        executablePath: $chromium,
        headless: $headless,
        args: [
          "--disable-extensions-except=\($extension)",
          "--load-extension=\($extension)"
        ]
      }
    }
  }' >"${work_dir}/config.json"

# 終了時に一時ディレクトリを消すため、exec せずに子プロセスとして起動する。
# 作業ディレクトリ（出力先の .playwright-mcp/ と、ファイルを読み書きできる範囲）はリポジトリの直下
cd "${repo_root}"
pnpm exec playwright-mcp --config "${work_dir}/config.json" "$@"
