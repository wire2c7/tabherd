# Tasks

## 1. debounceChanges の拡張

- [x] 1.1 `utils/grouping/debounce.ts` の `debounceChanges` を、`{ onChange, waitUntilSettled }` を返すように変更し、TSDoc を更新する
- [x] 1.2 `utils/grouping/debounce.test.ts` を新しい戻り値の形に合わせて更新し、`waitUntilSettled()` の前提・検証コメント付きテスト（保留中が無ければ即座に解決する／保留中があれば確定するまで解決しない／例外時も解決する）を追加し、`pnpm test -- utils/grouping/debounce.test.ts` が通ることを確認する

## 2. regroupTab の待機

- [x] 2.1 `entrypoints/background/grouping.ts` の `regroupTab` が、タブを判定する前に `waitUntilSettled()` を待つように変更し、`pnpm typecheck` が通ることを確認する

## 3. Issue 再現のテスト

- [x] 3.1 `entrypoints/background/grouping.test.ts`（新規）に、偽のタイマーで Issue #36 の再現手順（ルール保存 → 300ms以内にタブイベント → 300ms以内に色変更 → デバウンス確定）を再現し、最終的にグループの色が揃うことを確かめるテストを追加し、`pnpm test -- entrypoints/background` が通ることを確認する

## 4. ADR とドキュメント

- [x] 4.1 `docs/adr/` に、選んだ修正方針（タブイベントをデバウンスに合わせて待たせる、待機に上限を設けない）の決定を記録する ADR を追加する

## 5. 全体検証

- [x] 5.1 `pnpm typecheck`・`pnpm lint`・`pnpm test`・`nix flake check`・`prek run --all-files` が通ることを確認する
