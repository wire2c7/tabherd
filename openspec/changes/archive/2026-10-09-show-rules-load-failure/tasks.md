# Tasks

## 1. useRules の読み込み状態を判別共用体にする

- [x] 1.1 `components/rule-settings/use-rules.ts` の `RulesState` を、`components/log-settings/count.ts` の `StoredLogCount` と同じ形の判別共用体（読み込み中・成功・失敗）を持つように変える。`isDamaged`・`update` は成功時の情報・操作として扱う。既存の呼び出し側（`rule-settings.tsx`）が壊れていないことは `pnpm typecheck` で確かめる
- [x] 1.2 `subscribeRules` の `load()` を、`useRules` から呼び直せる形にする（再読み込みの土台）。`store.read()` が失敗したときは、`console.error` に加えて読み込み失敗の状態を `onChange` 相当の経路で呼び出し側に伝える
- [x] 1.3 `useRules` に `retry: () => void` を追加し、呼ぶと `load()` をもう一度実行する
- [x] 1.4 単体テスト（`components/rule-settings/use-rules.test.ts` を新設）で、`subscribeRules` が「読み込み成功」「読み込み失敗（console.error を確認）」「失敗後の retry で成功」「失敗後の retry でも失敗」「失敗より先に変更通知が来た場合に上書きしない」の5パターンを正しい状態で伝えることを確かめた。`subscribeRules`・`RulesSubscription`・`RulesSubscribed` を `use-rules.ts` からテスト用に export した

## 2. 設定画面の表示

- [x] 2.1 `components/rule-settings/rule-settings.tsx` の `RuleSettings` を、読み込み失敗の状態のときに「読み込み中…」の代わりに失敗を示すメッセージ（`log-settings` の文言スタイルに揃える。例: 「保存されたルールを読み込めませんでした」）と「再読み込み」ボタンを表示するように変える（`RuleListOrStatus`・`RuleLoadFailure` を `rule-list-status.tsx` に、`RuleList` を `rule-list.tsx` に分けて `max-lines`/`max-lines-per-function` に収めた）
- [x] 2.2 読み込み失敗中は「＋ ルールを追加」ボタンの `disabled` 条件に失敗状態を含める
- [x] 2.3 「再読み込み」ボタンを押すと `retry()` を呼ぶ

## 3. Spec との対応を確かめる E2E

- [x] 3.1 `e2e/rule-settings-load-failure.e2e.ts` を新設し、`openspec/specs/rule-settings-ui/spec.md` の新しい Requirement「ルールの読み込みの失敗」に対応する `test.describe` を追加する（`rule-settings.e2e.ts` に追加すると `max-lines` の300行を超えるため別ファイルに分けた）
- [x] 3.2 Scenario「読み込みが失敗する」「再読み込みに成功する」「再読み込みに失敗する」を自動化できた。`page.addInitScript` で `chrome.storage.local.get("rules")` を一時的に失敗させる。実装時に分かった注意点:
  - `addInitScript` へ渡す引数に `Number.POSITIVE_INFINITY` を使うと `null` に化けてシリアライズされる（Playwright の既知の挙動）ため、代わりに `Number.MAX_SAFE_INTEGER` を使う
  - `@wxt-dev/storage` は `defineItem` の時点で内部のキャッシュを温めるため（`migrationsDone.then(getOrInitValue)`、`.catch` が無い）、注入した失敗で `chrome.storage.local.get("rules")` を1回余分に消費し、かつその失敗は `weberror`（未処理の Promise の拒否）として漏れる。`expectedErrors` でまとめて許容し、「2回目の失敗で初めて再読み込みが成功する」ことをテストのコメントに明記した
- [x] 3.3 3.2 が自動化できたため、`test.fixme` での代替は不要

## 4. 仕上げ

- [x] 4.1 `pnpm typecheck`・`pnpm lint`・`pnpm fmt:check`・`pnpm test` が通ることを確認した
- [x] 4.2 `nix flake check` と `prek run --all-files` が通ることを確認した
- [x] 4.3 `openspec archive show-rules-load-failure` でこの change をアーカイブし、`openspec/specs/rule-settings-ui/spec.md` に新しい Requirement を反映する
