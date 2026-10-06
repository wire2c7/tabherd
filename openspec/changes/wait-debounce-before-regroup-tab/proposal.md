# Proposal

## Why

ルールの変更は 300ms デバウンスしてから反映する（`utils/grouping/debounce.ts`）が、タブの URL 変更等のイベント（`tabs.onUpdated`・`onAttached`）はデバウンスを待たず、その時点でストレージにある最新のルールを読んで即座にタブを判定する。このため、デバウンスの途中（中間状態）のルール値でタブイベントがグループを作ってしまうと、デバウンスが確定したときの差分（デバウンス開始前 vs 終了後の2点比較）ではその中間状態の存在が見えず、作られたグループのタイトル・色が古いままになる（Issue #36）。

## What Changes

- `utils/grouping/debounce.ts` の `debounceChanges` が、進行中のデバウンスの確定を待てる `waitUntilSettled()` を追加で返すようにする
- `entrypoints/background/grouping.ts` の `regroupTab`（タブの URL 変更・ウィンドウ移動によるタブ単位の判定）が、判定の前に進行中のルール変更のデバウンスの確定を待つようにする。待機に上限は設けない
- 既存の `plan.ts`・`rule-change.ts` の挙動（ルール変更時の差分計算・グループの色・タイトルの更新）は変更しない

## Capabilities

### New Capabilities

なし

### Modified Capabilities

なし（`auto-grouping` の既存の要件「タブの判定とグループ化」「ルールの変更の反映」は、すでに最終的に正しい状態になることを求めている。この変更はその要件を実装が満たすようにする不具合修正であり、要件の文言自体は変わらないため `skip_specs: true` とする）

## Impact

- 影響するコード: `utils/grouping/debounce.ts`（公開APIの戻り値の形が関数から `{ onChange, waitUntilSettled }` に変わる）、`entrypoints/background/grouping.ts`
- 影響する振る舞い: ルール編集中（300ms以内）にタブを開く・移動するという稀な重なりのときだけ、タブのグループ化が最大でそのデバウンスの残り時間だけ遅れる。通常のタブ操作（ルールを編集していないとき）への影響は無い
- 関連 Issue: #36
