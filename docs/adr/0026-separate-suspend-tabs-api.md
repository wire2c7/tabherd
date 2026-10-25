# 0026. タブグループのサスペンド用に、グルーピングとは別のブラウザAPIインターフェースを置く

- ステータス：Accepted
- 日付：2026-10-25
- 関連 Issue：#77

## コンテキスト

タブグループ単位の手動サスペンド（#77）を実装するにあたり、`chrome.tabs.discard` を呼ぶ処理と、
サスペンド対象のウィンドウのタブグループ・タブを取得する処理が要る。既存の `utils/grouping/tabs.ts` の
`TabsApi` は、自動グルーピング（`utils/grouping/`）の計画・実行に必要な操作だけに絞ったインターフェース
（`queryTabs`・`queryGroups`・`group`・`ungroup`・`updateGroup`・`moveGroup`）になっている。

ブラウザのタブ・タブグループの API を使うコードは `entrypoints/platform/` に閉じ込め、`utils/` にはインター
フェースだけを置く（ADR 0021）。サスペンドの機能もこの原則に従う必要がある。

## 検討した選択肢

- **`TabsApi` に `discard` 等を追加する**：実装をまとめられ、インターフェースも1つで済む。一方、サスペンド
  はグルーピングの計画を読み書きしないため、自動グルーピングと無関係な操作が `TabsApi` に増える。
  `utils/grouping/` のテストが使う偽物（fake）にも、グルーピングでは使わないメソッドの実装が要るようになる
- **`utils/suspend/tabs.ts` に新しいインターフェース（`SuspendTabsApi`）を作る**：`TabsApi` に手を入れず、
  自動グルーピングとサスペンドが疎結合のままになる。一方、ウィンドウのタブグループを取得する処理
  （`tabGroups.query`・`tabs.query` の組み合わせ）が、`entrypoints/platform/tabs.ts`（グルーピング用）と
  `entrypoints/platform/suspend-tabs.ts`（サスペンド用）の双方に似た形で存在することになる

## 決定

`utils/grouping/tabs.ts` の `TabsApi` は拡張せず、`utils/suspend/tabs.ts` に `SuspendTabsApi`
（`queryWindowGroups`・`discardTabs`）を新しく定義する。WXT による実装は
`entrypoints/platform/suspend-tabs.ts` に置く。

- 理由：サスペンドは自動グルーピングの計画を読み書きしない、独立した機能のため、同じインターフェースに
  混ぜると両機能が疎結合でなくなる。似た取得処理が2箇所に存在する重複より、機能ごとに最小のインター
  フェースを保つことを優先した

## 結果

- `utils/grouping/` の既存の実装・テストには手を入れていない
- `utils/suspend/` と `entrypoints/platform/suspend-tabs.ts` が、サスペンド専用のブラウザAPIインター
  フェースと実装を持つ
- 今後、タブ・タブグループに関わる機能を追加するときも、その機能が自動グルーピングの計画を読み書きしない
  限り、独立したインターフェースを `utils/<機能名>/tabs.ts` に置く方針とする
