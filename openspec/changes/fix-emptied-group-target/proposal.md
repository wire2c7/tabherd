# Proposal

## Why

同じ判定の中で、あるグループの元のタブがすべて外れる・別のグループへ移ると、そのグループは Chrome に消され、同じグループへ入れるはずのタブがどのグループにも入らない（#47）。#46 の性質のテストで見つかり、Chromium でも再現した。

## What Changes

- タブを入れる既存のグループを選ぶとき、同じ判定で元のタブがすべて出ていくグループを候補から外す。残る同名のグループがあれば（左のものへ）入れ、無ければルールのグループ名・色で新しく作って入れる
- #46 で `it.fails` にした `planGrouping` の性質のテストを `it` に戻し、#47 の反例を例のテストにも加える

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `auto-grouping`: 「タブの判定とグループ化」で、入れる先の既存のグループから、同じ判定で元のタブがすべて出ていくグループを除く

## Impact

- `utils/grouping/plan.ts`: `planGrouping` の入れる先のグループの選び方
- `utils/grouping/plan.test.ts`・`utils/grouping/plan.property.test.ts`: 例のテストの追加と、`it.fails` を `it` に戻す
- `openspec/specs/auto-grouping/spec.md`: アーカイブ時に「タブの判定とグループ化」を更新する
