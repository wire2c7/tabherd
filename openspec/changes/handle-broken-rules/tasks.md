# Tasks

## 1. 保存値の読み込み

- [x] 1.1 `utils/rules/parse.ts` に `parseRules` を作り、`parse.test.ts` で design.md の各規則（配列でない・ルールを除く・同じ ID・条件の一覧・条件を除く・色・余分なプロパティ・壊れていない値）を確かめる
- [x] 1.2 `utils/rules/storage.ts` に `readRules`・`watchRules` を加え、`storage.test.ts` で壊れた値を直して返すことを確かめる

## 2. background

- [x] 2.1 `utils/rules/reader.ts` に、壊れた状態ごとに1回だけ警告のログを残す `createRulesReader` を作り、`reader.test.ts` で確かめる
- [x] 2.2 `entrypoints/background.ts` のルールの読み込みと購読を `createRulesReader` に替える

## 3. 設定画面

- [x] 3.1 `use-rules.ts` で `readRules`・`watchRules` を使い、壊れていたかを返す。変更したときに警告の状態を消す
- [x] 3.2 `rule-settings.tsx` で、壊れていたときに一覧の上に警告を表示する

## 4. 全体の確認

- [x] 4.1 `pnpm test`・`pnpm typecheck`・`pnpm lint`・`prek run --all-files`・`nix flake check`・`nix develop .#e2e --command pnpm e2e` が通ることを確かめる
- [x] 4.2 E2E の devShell の Chromium で、#56 の再現手順で background が例外で止まらず警告のログを残すこと、設定画面が警告とともに一覧を表示し、編集で警告が消えることを確かめる
- [x] 4.3 design.md・spec の差分が実装と食い違っていないかを確かめ、食い違いは実装を正として直す
