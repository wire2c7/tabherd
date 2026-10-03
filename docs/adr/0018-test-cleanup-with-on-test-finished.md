# 0018. 単体テストの後片付けは onTestFinished で登録する

- ステータス：Accepted
- 日付：2026-10-03
- 関連 Issue：#52

## コンテキスト

単体テスト（Vitest）の中で、モックの復元（`mockRestore`）や購読の解除をテストの最後に書いていた。途中の `expect` が失敗するとそこまで実行されず、モックや購読が同じファイルの後のテストに残り、1つの失敗が関係の無いテストの失敗として現れる。

前提と制約:

- `beforeEach`・`afterEach` 等のフックは Oxlint の `vitest/no-hooks` で禁じている（ADR 0010 の方針でカテゴリ単位に有効にしたルールの1つ）
- Oxlint の vitest プラグインは、`vitest` から import した `it`・`describe` をテストとして見分けて検査する

## 検討した選択肢

- **テストの最後に書く（これまで）**：途中で失敗すると後片付けされない
- **`beforeEach`・`afterEach`**：`vitest/no-hooks` に反する。準備がテストの外に分かれ、各テストで何が用意されるかが読みにくくなる
- **`it.extend`（Vitest のフィクスチャ）**：テストが失敗しても後片付けされる。ただし Oxlint 1.85 は、`it.extend` で作った `it` をテストとして見分けない。わざと問題を入れたテストで試すと、次のようになった
  - `no-focused-tests`（`.only`）・`no-disabled-tests`・`no-identical-title`・`prefer-lowercase-title`・`expect-expect`・`padding-around-test-blocks` が検出しなくなる
  - `no-standalone-expect`・`prefer-importing-vitest-globals` の誤った指摘が出る
  - `expect`・`vi` に対する検査（`valid-expect`・`prefer-to-be`・`require-mock-type-parameters` 等）は効き続ける
  - 別名を登録する設定（`additionalTestBlockFunctions`）は3つのルールにしか無い
- **`onTestFinished` で後片付けを登録する補助関数**：`vitest` の `it` のまま書け、lint がすべて効く。`onTestFinished` はテストが失敗しても呼ばれ、`vitest/no-hooks` の対象外

## 決定

- テストの中の後片付けは、`vitest` の `onTestFinished` で登録する。準備と後片付けの登録をまとめた補助関数を、テストの最初（後片付けが要るものを作る前）に呼ぶ
  - `vi.spyOn` のモックは、`utils/testing/mocks.ts` の `restoreMocksAfterTest` で戻す
  - 偽のタイマーは、`utils/testing/mocks.ts` の `useFakeTimersInTest` で使い、本物のタイマーに戻す
  - ログの受け取り（`captureLogs`）や購読（`watchCounts`）のように、作ったものを返す補助関数は、作るときに自分の後片付けを登録する
- `it.extend` は使わない。`beforeEach`・`afterEach` も、これまでどおり使わない
- 既にあるテストのうち、後片付けの要らないものは書き換えない

## 結果

- テストが失敗しても後片付けされ、1つの失敗が後のテストに波及しない
- `vitest` の `it` のままなので、Oxlint の vitest のルールがすべて効く
- 補助関数を呼び忘れると後片付けされない。`vi.spyOn` を使うテストでは `restoreMocksAfterTest` を先に呼ぶ
- Oxlint が `it.extend` を見分けるようになったら、フィクスチャに移すかを改めて判断する。Oxlint の対応は [oxc-project/oxc#26675](https://github.com/oxc-project/oxc/issues/26675) で追う。別のファイルから import した `it` については、oxc は元の eslint-plugin-vitest に合わせて `additionalTestBlockFunctions` で対処する方針を示している（[oxc-project/oxc#21844](https://github.com/oxc-project/oxc/issues/21844)）
