# Design

## Context

- 使われないルールは、グループ名が空のルールと、ほかのルールが使っているグループ名のルール（`findRuleProblems` が null 以外を返すもの）。重複の判定は background の記録（`local:ruleGroupTitles`）に依存する（#70）
- 拡張機能のアイコン（manifest の `action`）は popup を持ち、説明は manifest の `default_title`（`TabHerd`）
- background はルールの変更を 300ms まとめて反映し、反映のたびに記録を書く。インストール・更新時とブラウザの起動時も同じ反映を通る

## Goals / Non-Goals

**Goals:**

- 設定画面の一覧のどこに使われないルールがあっても、開いた時点で気づける
- 設定画面を閉じていても、使われないルールがあることに気づける

**Non-Goals:**

- 構文が不正な正規表現の条件を数えること（ルールは有効なまま、その条件だけが一致しない）
- 通知から該当するルールへ移動すること

## Decisions

### 数え方は設定画面と background で同じ関数にする

`utils/rules/match.ts` の `countUnusedRules(rules, titles)` で、`findRuleProblems` が null 以外を返すルールを数える。設定画面は記録を読んで（`useRuleTitles`）、background は反映後の記録で数える。

### バッジと説明は反映のたびに更新する

background の反映（ルールの変更・インストール・更新・ブラウザの起動）の最後に、反映後のルールと記録で数え、`action.setBadgeText`・`action.setTitle` を呼ぶ。

- 採用理由: 反映は 300ms まとめた後に動くため、打ち直しの途中でバッジがちらつきにくい。反映後の記録で数えるため、設定画面の表示と食い違わない
- バッジは件数ではなく「!」にする（タブの数等と取り違えないため）。件数は説明に出す
- 0 件のときは、バッジを空にし、説明を manifest の `default_title` に戻す
- 却下した案: ルールの保存値の変更をすぐに数える。打ち直しのたびにバッジがちらつき、記録が書かれる前の重複の判定と食い違う

## Risks / Trade-offs

- [バッジの更新が失敗する] → 反映の処理の一部としてエラーをログに残す。次の反映で更新し直す
- [Service Worker が起き直しただけではバッジを更新しない] → バッジは Service Worker が止まっても残る。ブラウザを起動し直したときは、起動時の反映で更新する
