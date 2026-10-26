# Tasks

## 1. ルールの条件に対象（URL・タイトル）を追加する

- [x] 1.1 `utils/rules/types.ts` の `ConditionSchema` に `target: optional(picklist(["url", "title"]))` を追加し、`ConditionType` と並ぶ `ConditionTarget` 型と、既定値を解決する `conditionTarget` 関数を定義する。`pnpm typecheck` が通ることで確認する
- [x] 1.2 `utils/rules/parse.ts` に、`type`・`value` は読めるが `target` が不正な条件を「`target` を省略した（URL を対象にした）条件に直して残す」パス（`RepairableRuleSchema` と同様の直し用スキーマ）を追加する。`utils/rules/parse.test.ts` に、壊れた `target` を持つ条件が URL 条件として残るテストを追加して確認した
- [x] 1.3 `utils/rules/match.ts` の `matchesCondition`・`matchesRule`・`findMatchingRule` の対象引数を `url: string` から `MatchTarget`（`{ url: string; title: string }`）に変え、`conditionTarget(condition)` に応じて見る文字列を切り替える。`utils/rules/match.test.ts` に、タイトルを対象にした部分一致・正規表現・値が空・タイトル未確定（空文字列）・URL とタイトルを組み合わせたルールのテストケースを追加して確認した

## 2. タブのタイトルを判定に使えるようにする

- [x] 2.1 `utils/grouping/tabs.ts` の `BrowserTab` に `title?: string | undefined` を追加した（`entrypoints/platform/tabs.ts` の `queryTabs` は構造的部分型のため変更不要。`browser.tabs.query` が返す `Tab` はすでに `title` を持つ）。`utils/grouping/types.ts` の `TabSnapshot` にも `title: string`（未確定時は空文字列）を追加した
- [x] 2.2 `utils/grouping/plan.ts` の `matchesRule` 呼び出しを `{ url: tab.url, title: tab.title }` を渡す形に直し、`utils/grouping/plan.test.ts` にタイトル条件で判定が変わるケースを追加して確認した
- [x] 2.3 `TabSnapshot` を作っている箇所（`utils/grouping/snapshot.ts` の `takeWindowSnapshots`）で `tab.title ?? ""` を詰めるよう直し、関連するテスト（`order.test.ts`・`plan.test.ts`・`plan.property.test.ts`・`rule-change.test.ts`・`testing/arbitraries.ts`・`testing/model.test.ts`）を更新した

## 3. タイトル変化を再判定のトリガーにする

- [x] 3.1 `utils/grouping/debounce.ts` の `debounceChanges` はそのまま使い、`entrypoints/background/grouping.ts` に `onTitleChanged`（タブ ID ごとの `debounceChanges<string>` インスタンスを持つ `Map` を受け取るリスナー生成関数）を追加した。`TITLE_CHANGE_DEBOUNCE_MS`（500ms）の定数を定義した
- [x] 3.2 `onTitleChanged` で `changeInfo.title !== undefined` の分岐を実装し、該当タブの debounce インスタンスへ値を渡して確定後に `regroupTab` を enqueue するようにし、`regroupOnEvents` で `browser.tabs.onUpdated` に追加の listener として登録した
- [x] 3.3 `onTabRemoved` を実装し、`browser.tabs.onRemoved` を購読して閉じたタブの debounce インスタンスを `Map` から削除するようにした
- [x] 3.4 `entrypoints/background/grouping.test.ts`（既存のテストファイル）に、タイトル変化がデバウンスされて1回だけ再判定されるケースと、`onTabRemoved` でタブを閉じた後に `Map` のエントリが残らないことを確かめるケースを追加して確認した

## 4. 設定画面でタイトル条件を編集できるようにする

- [x] 4.1 `components/rule-settings/condition-editor.tsx` に対象（URL・タイトル）の `<select>`（`TargetSelect` コンポーネント）を追加し、`CONDITION_TARGET_LABELS` を定義した。`components/rule-settings/condition-editor.test.tsx` を新規に作成し、初期表示が URL であること・対象をタイトルに変えると `target: "title"` で即座に `onChange` が呼ばれることを確認した
- [x] 4.2 `PLACEHOLDERS`（対象・種類の組み合わせごとのプレースホルダー）を定義し、値の入力欄で対象に応じて出し分けるようにした

## 5. 統合確認

- [x] 5.1 `pnpm test`（307件）・`pnpm typecheck`・`pnpm lint`・`pnpm fmt:check` がすべて通ることを確認した
- [x] 5.2 `pnpm build` 後、Playwright MCP で実際に拡張機能を動かし確認した。タイトルを対象にした部分一致ルール「レビュー」（`Pull Request` を含む）を作り、タイトルにその文字列を含むページを開くと、タブグループ「レビュー」が作られてタブが入ることを確認した

## Workflow follow-up

- レビュー後、`openspec-archive-change` でこの変更をアーカイブする
- アーカイブ後、`openspec/specs/grouping-rules`・`auto-grouping`・`rule-settings-ui` の本体の Spec に正しく反映されたことを確認する
