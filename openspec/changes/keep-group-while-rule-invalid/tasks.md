# Tasks

## 1. タイトルの記録と有効性

- [x] 1.1 `utils/rules/` に、ルールが持っているグループのタイトル（`RuleTitles`）の型・読み込み（壊れた値は空とみなす）・保存先を置く
- [x] 1.2 `findRuleProblems`・`validRules` が記録を受け取り、同じ名前のルールのうち記録でその名前を持っているルールを有効にする
- [x] 1.3 無効なルールが持ち続けるタイトルと、ルールの順のタイトルの一覧を求める関数を置く

## 2. 反映

- [x] 2.1 `diffRules` が記録を受け取り、新しい記録・タイトルの変更・使われなくなったタイトルを返す
- [x] 2.2 `planGrouping`・`planGroupOrder`・`regroup.ts` が記録を使い、無効なルールのグループをルールの位置に置いたまま触れないようにする
- [x] 2.3 background が記録を読み、反映した後（起動時の判定し直しを含む）に保存する

## 3. 設定画面

- [x] 3.1 設定画面が記録を読んで重複を判定し、エラーの文言をほかのルールと同じ旨に変える

## 4. 確認

- [x] 4.1 Vitest と E2E のテストで、Spec のシナリオ（空にする・打ち直す・起動し直す・ほかのルールの名前を通る・並び）を確かめる
- [x] 4.2 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix develop .#e2e --command pnpm e2e`・`prek run --all-files`・`nix flake check`・`openspec validate --strict` が通ることを確かめる
- [x] 4.3 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
