# Design

## Context

`components/rule-settings/use-rules.ts` の `useRules` は `RulesState { rules: readonly Rule[] | null; isDamaged: boolean; update }` を返す。`rules === null` を「読み込み中」として扱っており、読み込みの失敗と区別できない。同じアプリ内の `components/log-settings/count.ts` の `StoredLogCount`（`{status:"loading"}|{status:"loaded";count}|{status:"failed"}`）が、同種の状況への既存パターン。proposal.md の Why を参照。

## Goals / Non-Goals

**Goals:**

- 読み込みの「中」「成功」「失敗」を型で区別できるようにする
- 失敗時に再読み込みできるようにする

**Non-Goals:**

- 保存（`update`）の失敗時の表示の変更（既存のまま。本変更は読み込みの失敗のみを扱う）
- `useRuleTitles`（`RuleTitlesStore` の読み込み）の失敗時の表示の変更（既に `NO_TITLES` へのフォールバックがあり、Issue #74 の対象外）

## Decisions

- **`RulesState.rules` の型を `readonly Rule[] | null | "failed"` のような判別しにくい形にせず、`status` フィールドを持つ判別共用体に変える**: `log-settings/count.ts` の `StoredLogCount` と同じ形にすることで、読み込み系の状態表現をアプリ内で揃える。具体的には `RulesState` を次のいずれかの形に変える。
  - 案: `rules: readonly Rule[] | null` はそのまま残し、別に `loadError: boolean` を持たせる
  - 採用: `load: { status: "loading" } | { status: "loaded"; rules: readonly Rule[] } | { status: "failed" }` を新設し、既存の `rules`（呼び出し側がよく使う）は `load.status === "loaded" ? load.rules : null` から導出するヘルパーを `rule-settings.tsx` 側で使う
  - 理由: `isDamaged`・`update` は「読み込めている」ことが前提の情報・操作のため、`load` を分けることで「読み込めていない」ケース（loading・failed）を型で一箇所にまとめられる
- **再読み込みは `subscribeRules` の `load()` を呼び直すのではなく、`useRules` に `retry: () => void` を足し、内部で読み込み処理をもう一度呼ぶ**: `subscribeRules` は `useEffect` の中で一度だけ呼ばれるため、再読み込みのたびに `useEffect` を再実行させる（例: リトライ回数を state に持ち `useEffect` の依存に含める）か、`load` 関数を `useRules` の外に出して `retry` から直接呼べるようにする。後者を採用し、`subscribeRules` が返す `load` 関数自体を呼び出し側（`useRules`）に渡す
- **失敗中の watch（他画面からの変更通知）は無視しない**: 読み込みの失敗後もストレージの変更通知は購読し続け、通知が来れば（他の画面がルールを保存する等）その内容で復帰できるようにする。既存の `subscribeRules` の構造を変えない

## Risks / Trade-offs

- [`RulesState` の形が変わるため、`rule-settings.tsx` 側の呼び出しも書き換えが要る] → 影響範囲は `RuleSettings` コンポーネント1つのみ（grep で確認済み）
- [再読み込みのたびに `store.read()` を呼ぶため、失敗が続く環境では利用者が連打すると呼び出しが増える] → 既存の保存操作にも連打のガードが無く、今回新たに導入するものではないため許容する
