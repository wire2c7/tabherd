# Tasks

## 1. サンプルルールの定義

- [x] 1.1 `utils/rules/seed.ts` に `createSampleRules(): Rule[]` を実装する（`⚙設定`・`📺️動画`・`📃ブログ` の3件、ID は `crypto.randomUUID()`、色は `pickNewRuleColor` で順番に割り当てる）。Vitest のユニットテストで、3件の名前・条件・色（互いに異なり grey 以外）を検証する
- [x] 1.2 `pnpm typecheck` と `pnpm test` が通ることを確認する

## 2. 初回インストール時の投入

- [ ] 2.1 `entrypoints/background/rules.ts` に書き込み用の `rulesStore`（`createRulesStore(defineStorageItem(RULES_ITEM))`）をエクスポートする
- [ ] 2.2 `entrypoints/background/grouping.ts` の `onInstalled` リスナーで、`details.reason === "install"` かつ `rulesReader.read()` が空配列のときだけ `rulesStore.write(createSampleRules())` を `await` してから `enqueue(regroupAll)` を呼ぶよう変更する
- [ ] 2.3 `grouping.test.ts`（または新規テストファイル）に、(a) 初回インストールでサンプルルールが保存されること、(b) `reason === "update"` では投入されないこと、(c) 既にルールがある状態の `install` イベントでは投入されないこと、の3シナリオのテストを追加し、`pnpm test` で通ることを確認する

## 3. 仕様・ドキュメントの反映

- [ ] 3.1 `pnpm lint` と `pnpm fmt:check`（または `pnpm fmt`）を実行し、問題が無いことを確認する
- [ ] 3.2 `docs/adr/0027-seed-sample-rules-on-install.md`（番号は作成時点の最新連番+1）を `docs/adr/_template.md` から作成し、本設計判断（投入タイミング・書き込み用ストアの公開場所・サンプルルールの内容）を記録する
- [ ] 3.3 `nix flake check` と `prek run --all-files` が通ることを確認する

## Workflow follow-up

- レビュー後、`openspec sync specs` で `openspec/specs/grouping-rules/spec.md` にこの change の delta を反映する
- この change を archive する
