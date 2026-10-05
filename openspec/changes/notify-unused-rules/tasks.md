# Tasks

## 1. 数え方

- [x] 1.1 `utils/rules/match.ts` に、使われないルールを数える `countUnusedRules` を置く

## 2. 設定画面

- [x] 2.1 設定画面の一覧の上に、使われないルールの件数を表示する（記録を読んで重複を判定する）

## 3. バッジ

- [x] 3.1 background の反映の最後に、使われないルールがあればバッジ「!」と件数の説明を出し、無ければ消す

## 4. 確認

- [x] 4.1 Vitest と E2E のテストで、Spec のシナリオを確かめる
- [x] 4.2 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check`・`openspec validate --strict` が通ることを確かめる
- [x] 4.3 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
