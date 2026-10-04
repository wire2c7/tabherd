# Tasks

## 1. 判断の記録

- [ ] 1.1 最低の Chrome バージョンを 140 にすること（111・119・148・152・定期的に上げる方針・`build.target` を合わせる案を採らない理由を含む）を `docs/adr/` に ADR として残す

## 2. 宣言

- [ ] 2.1 `wxt.config.ts` の manifest に `minimum_chrome_version: "140"` を書き、`pnpm build` した `.output/chrome-mv3/manifest.json` にあることを確かめる
- [ ] 2.2 `AGENTS.md` の規約に、使う API を最低版で使えるものに限ること（最低版は `wxt.config.ts`、決め方は ADR）を書く

## 3. 全体の確認

- [ ] 3.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check` が通ることを確かめる
- [ ] 3.2 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
