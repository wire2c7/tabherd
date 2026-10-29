# Tasks

## 1. debounceChanges の拡張

- [x] 1.1 `utils/grouping/debounce.ts` の `debounceChanges` を、`{ onChange, waitUntilSettled }` を返すように変更し、TSDoc を更新する
- [x] 1.2 `utils/grouping/debounce.test.ts` を新しい戻り値の形に合わせて更新し、`waitUntilSettled()` の前提・検証コメント付きテスト（保留中が無ければ即座に解決する／保留中があれば確定するまで解決しない／例外時も解決する）を追加し、`pnpm test -- utils/grouping/debounce.test.ts` が通ることを確認する

## 2. ルール変更の反映を、バーストの最初の変更時点でキューへ積む

- [x] 2.1 `entrypoints/background/grouping.ts` の `rulesReader.watch` のリスナー（`onRulesChanged`）を、バーストの最初の変更があった時点で反映のタスクを `enqueue` し、タスク自身が `waitUntilSettled()` を待ってから反映するように変更する。`regroupTab` 自体は変更しない（待たせない）。`pnpm typecheck` が通ることを確認する

## 3. Issue 再現のテスト

- [x] 3.1 `entrypoints/background/grouping.test.ts`（新規）に、モック TabsApi と偽のタイマーで `regroupOnEvents` の設計（バースト追跡）を再現するテストハーネスを作り、Issue #36 の再現手順（ルール保存 → 300ms以内にタブイベント → 300ms以内に色変更 → デバウンス確定）で最終的にグループの色が揃うことを確かめる
- [x] 3.2 同じテストハーネスで、Issue #81 の再現手順（名前が衝突する編集の直後にタブイベントが来る）でも、確定後に正しいグループへ入ることを確かめる
- [x] 3.3 `pnpm test -- entrypoints/background` が通ることを確認する

## 4. ADR とドキュメント

- [x] 4.1 `docs/adr/` に、検討した選択肢（A〜F）と選んだ方針（G）の決定を記録する ADR を追加する

## 5. 全体検証

- [x] 5.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix flake check`・`prek run --all-files` が通ることを確認する
