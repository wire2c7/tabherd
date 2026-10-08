# Proposal

## Why

`components/rule-settings/use-rules.ts` の `subscribeRules` は、`store.read()` が失敗すると `console.error` を出すだけで `RulesState.rules` を更新しない。設定画面（`components/rule-settings/rule-settings.tsx`）は `rules === null` のあいだ「読み込み中…」を表示し続け、ルールの追加・編集もできないまま止まる（Issue #74）。失敗するのは `chrome.storage` の容量超過・拡張機能のコンテキストが無効になった場合等。

## What Changes

- `useRules` が返す一覧の状態に、読み込み中・成功・失敗を区別できる形を持たせる（`components/log-settings/count.ts` の `StoredLogCount` と同じ判別共用体のパターンに揃える）
- 設定画面は、読み込みが失敗したとき、読み込み中の表示の代わりに失敗した旨のメッセージと「再読み込み」ボタンを表示する
- 失敗中は「＋ ルールを追加」ボタンを押せないままにする（一覧の実体が無いため）
- 「再読み込み」ボタンを押すと `store.read()` をもう一度呼び、成功すれば一覧を表示し失敗の表示を消す

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `rule-settings-ui`: 「ルールの一覧」の要件に、読み込みが失敗したときの表示・操作（失敗の表示、追加操作の無効化、再読み込み）を追加する

## Impact

- 影響するコード: `components/rule-settings/use-rules.ts`（`RulesState` の形）、`components/rule-settings/rule-settings.tsx`（失敗時の表示・再読み込みボタン）
- 影響する振る舞い: `store.read()` が失敗したときだけ表示が変わる。成功時の見た目・操作は変わらない
- 関連 Issue: #74
