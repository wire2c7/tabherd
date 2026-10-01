# Tasks

## 1. 依存と判断の記録

- [x] 1.1 `fast-check` を `minimumReleaseAge` を満たす版で `pnpm add -D` し、`pnpm install` が `minimumReleaseAge`・`trustPolicy` に通ることを確かめる
- [x] 1.2 Property Based Testing と fast-check の採用（`@fast-check/vitest`・小さな入力をすべて試す方法・StrykerJS を採らない理由を含む）を `docs/adr/` に ADR として残す

## 2. arbitrary とモデル

- [x] 2.1 `utils/grouping/testing/arbitraries.ts` に、ウィンドウのスナップショット（ピン留めのタブが先頭、グループのタブが連続、まれにスナップショットに無いグループのタブ）・ルールの一覧・`planGrouping` の options の arbitrary を書き、生成したスナップショットが Chrome の制約（ピン留めのタブは先頭でグループに入らない、グループのタブは連続する、タブの ID は一意）を満たすことを性質のテスト（`arbitraries.test.ts`）で確かめる
- [x] 2.2 計画をスナップショットに適用するモデル（`utils/grouping/testing/model.ts`）（所属を変える操作と、左への `move-group`）を書き、既存の `order.test.ts` の例の計画を適用した結果が期待する並びになることをテスト（`model.test.ts`）で確かめる

## 3. 性質のテスト

- [ ] 3.1 `utils/grouping/plan.property.test.ts` に `planGrouping` の性質（適用後の所属、触れないタブ、正しいタブに操作を出さない・各タブは高々1つの操作、冪等）のテストを書き、`pnpm test` で通ることを確かめる
- [ ] 3.2 `utils/grouping/order.property.test.ts` に `planGroupOrder` の性質（適用後の並び、移動が左向きで `index` がピン留めのタブの数以上、タブの集合と所属が変わらない、冪等）のテストを書き、`pnpm test` で通ることを確かめる
- [ ] 3.3 実装をわざと壊し（`planGrouping` でピン留めのタブを判定する、`planGroupOrder` で `index` を1つずらす・同じルールのグループの順を崩す等）、それぞれ性質のテストが失敗して反例が出ることを確かめてから元に戻す

## 4. 全体の確認

- [ ] 4.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`prek run --all-files`・`nix flake check` が通り、性質のテストを含む `pnpm test` の実行時間が大きく延びないことを確かめる
- [ ] 4.2 design.md の記述が実装と食い違っていないかを確かめ、食い違いは実装を正として design.md を直す
