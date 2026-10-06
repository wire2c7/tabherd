# Design

## Context

- popup（`entrypoints/popup/app.tsx`）は現状ルール設定だけで、タブ・タブグループの状態を表示していない
- 既存の `utils/grouping/tabs.ts` の `TabsApi` は「グループ化に使う」ことを目的にしたインターフェースで、自動グルーピング（`utils/grouping/`）専用に絞った形（`queryTabs`・`queryGroups`・`group`・`ungroup`・`updateGroup`・`moveGroup`）になっている
- ブラウザAPIを使うコードは `entrypoints/platform/` に閉じ込め、`utils/` にはインターフェースだけを置く（ADR 0021）
- 保存するデータの形は valibot のスキーマで検証する（ADR 0020）
- 詳細は proposal.md・specs/tab-group-suspension/spec.md を参照

## Goals / Non-Goals

**Goals:**

- popup から、任意のタブグループ（TabHerd のルールで作られたものかどうかを問わない）のタブをまとめてサスペンドできるようにする
- 既存の自動グルーピングの実装（`utils/grouping/`）に手を入れない

**Non-Goals:**

- グループ一覧の自動更新（タブの増減やグループの変化に合わせた再描画）の実装方式の最適化。まずは popup を開いたときの一覧表示で十分とする
- サスペンド済みタブの復元・サスペンド状態の表示
- キーボードショートカットや右クリックメニューからの実行

## Decisions

### 新しいブラウザAPIのインターフェースを分けて置く

`utils/grouping/tabs.ts` の `TabsApi` を拡張して `discard` を足すのではなく、`utils/suspend/tabs.ts` に新しいインターフェース（`SuspendTabsApi` 等、`queryWindowGroups`・`discardTabs` を持つ）を作る。

- 理由: `TabsApi` は自動グルーピングの計画・実行に必要な操作だけに絞ってある。サスペンド機能はグルーピングの計画を読み書きしないため、同じインターフェースに混ぜると両機能が疎結合でなくなる
- 代替案: `TabsApi` に `discard` を追加する。実装はまとめられるが、グルーピングと無関係な操作が増え、`utils/grouping/` のテストの偽物（fake）にも不要なメソッドが要る

### 確認表示の設定は valibot の boolean スキーマで検証する

`utils/suspend/settings.ts` に `SuspendConfirmSchema = boolean()` を定義し、保存値の検証に使う（ADR 0020 に従う）。真偽値でない値（旧バージョンの壊れた値等）は fallback の `true` として扱う。

### popup はルール設定とは別の新規コンポーネントにする

`components/suspend-groups/`（グループ一覧・サスペンド操作）と、options 用の `components/suspend-settings/`（確認表示のON/OFF）を、`components/log-settings/`・`components/rule-settings/` と同じ構成（本体の `.tsx` と、ブラウザAPIに依存しない補助ロジックを別ファイルに分ける）で追加する。

- 理由: 既存の2つのコンポーネントと役割が独立しており、同じ構成に揃えることで一貫性を保てる

### 操作対象のウィンドウは `browser.windows.getCurrent()` で取得する

popup は常に特定のウィンドウに紐づいて開くため、`entrypoints/platform/` の実装で `browser.windows.getCurrent()` を呼び、そのウィンドウのタブグループだけを一覧・操作対象にする。

### 確認ダイアログは popup の DOM 上で `window.confirm()` を呼ぶ

popup は通常の拡張機能ページ（DOM を持つ）のため、追加の権限やUIを作らずに `window.confirm()` を呼べる。サスペンド操作の呼び出し元（`components/suspend-groups/`）から直接呼ぶ。

## Risks / Trade-offs

- [`window.confirm()` は同期的にUIをブロックする] → 対象タブ数が多くても一覧の取得自体は先に終えているため、確認中にポップアップが固まったように見える時間は短い。将来UIを揃えたくなった場合はカスタムダイアログへの置き換えを別途検討する
- [グループ一覧は popup を開いた時点のスナップショットで、開いている間のタブの増減には追従しない（Non-Goals）] → 利用者はサスペンド前に表示されたタブ数と、実行後の結果（アクティブ・ピン留めタブが除外される挙動）を確認できるため、致命的なズレは生まれない
- [サスペンド対象のグループにアクティブタブ・ピン留めタブしか無い場合、対象タブ0件で操作が空振りする] → ボタンを無効にするのではなく、0件実行時はエラーにせず何もしない（確認も出さない）。この挙動は tasks.md の実装で決める
