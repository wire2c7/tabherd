# Tasks

## 1. ルールの条件に対象（URL・タイトル）を追加する

- [ ] 1.1 `utils/rules/types.ts` の `ConditionSchema` に `target: optional(picklist(["url", "title"]), "url")` を追加し、`ConditionType` と並ぶ `ConditionTarget` 型を定義する。`pnpm typecheck` が通ることで確認する
- [ ] 1.2 `utils/rules/parse.ts` に、`type`・`value` は読めるが `target` が不正な条件を「`target: "url"` に直して残す」パス（`RepairableRuleSchema` と同様の直し用スキーマ）を追加する。`utils/rules/parse.test.ts` に、壊れた `target` を持つ条件が URL 条件として残るテストを追加して確認する
- [ ] 1.3 `utils/rules/match.ts` の `matchesCondition`・`matchesRule`・`findMatchingRule` の対象引数を `url: string` から `MatchTarget`（`{ url: string; title: string }`）に変え、`condition.target` に応じて見る文字列を切り替える。`utils/rules/match.test.ts` に、タイトルを対象にした部分一致・正規表現・値が空・タイトル未確定（空文字列）のテストケースを追加して確認する

## 2. タブのタイトルを判定に使えるようにする

- [ ] 2.1 `utils/grouping/tabs.ts` の `BrowserTab` に `title?: string | undefined` を追加し、`entrypoints/platform/tabs.ts` の `queryTabs` の実装で `browser.tabs.Tab.title` を詰める。`utils/grouping/types.ts` の `TabSnapshot` にも `title: string`（未確定時は空文字列）を追加する
- [ ] 2.2 `utils/grouping/plan.ts` の `matchesRule` 呼び出しを `{ url: tab.url, title: tab.title }` を渡す形に直し、`utils/grouping/plan.test.ts` にタイトル条件で判定が変わるケースを追加して確認する
- [ ] 2.3 `TabSnapshot` を作っている箇所（`BrowserTab` からの変換処理）で `tab.title ?? ""` を詰めるよう直し、関連するテストを更新する

## 3. タイトル変化を再判定のトリガーにする

- [ ] 3.1 `utils/grouping/debounce.ts` の `debounceChanges` はそのまま使い、`entrypoints/background/grouping.ts` の `regroupOnEvents` 内にタブ ID ごとの `debounceChanges<string>` インスタンスを持つ `Map` を追加する。`TITLE_CHANGE_DEBOUNCE_MS`（500ms）の定数を定義する
- [ ] 3.2 `browser.tabs.onUpdated` のリスナーに `changeInfo.title !== undefined` の分岐を追加し、該当タブの debounce インスタンスへ値を渡して確定後に `regroupTab` を enqueue する
- [ ] 3.3 `browser.tabs.onRemoved` を購読し、閉じたタブの debounce インスタンスを `Map` から削除する
- [ ] 3.4 `entrypoints/background/grouping.test.ts`（既存のテストファイル）に、タイトル変化がデバウンスされて1回だけ再判定されるケースと、タブを閉じた後に `Map` のエントリが残らないことを確かめるケースを追加して確認する

## 4. 設定画面でタイトル条件を編集できるようにする

- [ ] 4.1 `components/rule-settings/condition-editor.tsx` に対象（URL・タイトル）の `<select>` を追加し、`CONDITION_TARGET_LABELS` を定義する。対象を変えたときに `condition.target` が更新され即座に保存されることを、関連するコンポーネントテストで確認する
- [ ] 4.2 プレースホルダー文言（`placeholder`）を対象に応じて出し分ける（タイトル条件の部分一致・正規表現それぞれで分かりやすい例にする）

## 5. 統合確認

- [ ] 5.1 `pnpm test` ・`pnpm typecheck` ・`pnpm lint` がすべて通ることを確認する
- [ ] 5.2 `pnpm build` 後、`run` スキルまたは Playwright MCP で実際に拡張機能を動かし、タイトルを対象にしたルールでタブがグループ分けされることを目視で確認する

## Workflow follow-up

- レビュー後、`openspec-archive-change` でこの変更をアーカイブする
- アーカイブ後、`openspec/specs/grouping-rules`・`auto-grouping`・`rule-settings-ui` の本体の Spec に正しく反映されたことを確認する
