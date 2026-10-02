# Tasks

## 1. 入れる先のグループの選び方

- [x] 1.1 `utils/grouping/plan.test.ts` に #47 の2つの反例（元のタブがすべて外れる・別のグループへ移る）と、2つのグループの中身が入れ替わる場合の例のテストを加え、今の実装で失敗することを確かめる
- [x] 1.2 `utils/grouping/plan.ts` で、判定の後に元のタブが残るグループを求め、残るグループのうち左のものを入れる先にし、1.1 のテストと既存の `plan.test.ts` が通ることを確かめる
- [x] 1.3 `utils/grouping/plan.property.test.ts` の `it.fails` を `it` に戻してコメントを消し、`pnpm test` で性質のテストが（`examples` の反例を含めて）通ることを確かめる

## 2. 全体の確認

- [ ] 2.1 `nix develop .#e2e --command pnpm e2e`・`pnpm typecheck`・`pnpm lint`・`prek run --all-files`・`nix flake check` が通ることを確かめる
- [ ] 2.2 E2E の devShell の Chromium で拡張機能を動かし、#47 の再現手順で `.org` のタブが「資料」のグループに入ることを確かめる
- [ ] 2.3 design.md・spec の差分が実装と食い違っていないかを確かめ、食い違いは実装を正として直す
