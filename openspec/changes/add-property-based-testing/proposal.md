# Proposal

## Why

タブのグループ化・並べ替えの計画を組み立てる純粋関数（`planGrouping`・`planGroupOrder`）は、ピン留め・手動のグループ・同名のグループ・無効なルール等の組み合わせを受け取る。今のテストは例を挙げて確かめる形で、組み合わせを網羅できない。一方、成り立つべき性質（計画を適用した後の状態・冪等性）ははっきり書けるため、fast-check で入力を生成して性質を確かめる（#46）。

## What Changes

- fast-check を devDependencies に加える
- ウィンドウのスナップショットとルールの一覧を生成する arbitrary と、計画をスナップショットに適用するテスト用のモデルを作る
- `planGrouping` の性質のテストを書く（適用後の各タブの所属、冪等性、判定の対象外のタブに触れないこと）
- `planGroupOrder` の性質のテストを書く（適用後の並び、冪等性、移動が左向きであること）
- 上の判断を ADR に残す

## Capabilities

### New Capabilities

なし（開発用のテストの追加で、拡張機能の振る舞いは変わらない）

### Modified Capabilities

なし

## Impact

- `package.json`・`pnpm-lock.yaml`: devDependencies に `fast-check` を追加する
- `utils/grouping/testing/`（新規）: テスト用の arbitrary・モデルとそのテスト
- `utils/grouping/plan.property.test.ts`・`utils/grouping/order.property.test.ts`（新規）: 性質のテスト
- `docs/adr/`: Property Based Testing と fast-check の採用についての ADR
