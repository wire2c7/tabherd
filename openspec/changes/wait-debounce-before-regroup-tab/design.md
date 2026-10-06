# Design

## Context

`entrypoints/background/grouping.ts` の `regroupOnEvents` は、ルールの変更（`rulesReader.watch`）を `debounceChanges`（300ms）でまとめ、確定後に `applyAndSaveTitles` → `diffRules` で「デバウンス開始前の oldRules」と「終了後の newRules」の2点だけを比べて、既存のタブグループのタイトル・色の更新を計画する。

一方、`tabs.onUpdated`・`onAttached` はデバウンスを待たず、そのときストレージにある最新のルールを `readRulesState()` で読んで `regroupTab` が即座にタブを判定する。この2系統が同じ `createSerialQueue`（`utils/grouping/serial.ts`）に処理を積むため実行順序は直列になるが、`regroupTab` が「いつのルール値を読むか」は制御されておらず、デバウンス確定前の中間状態を読みうる。中間状態でタブグループが作られると、確定後の2点比較はその中間状態を経由したことを知らないため、作られたグループは古いタイトル・色のまま直らない（詳細は proposal.md）。

## Goals / Non-Goals

**Goals:**

- デバウンスの途中の中間状態のルール値で、タブイベントがタブグループを作ってしまうこと自体を無くす
- `plan.ts`・`rule-change.ts` の既存の挙動（差分計算・判定ロジック）には手を入れない

**Non-Goals:**

- デバウンスの差分の取り方自体の変更（中間状態の累積追跡）は行わない
- ルール変更後のタブ判定（`regroupAllWindows`）側の挙動変更は行わない

## Decisions

### 直し方

**選んだ方針**: `regroupTab` が、タブを判定する前に「進行中のルール変更のデバウンスが確定するまで」待つ。`utils/grouping/debounce.ts` の `debounceChanges` に `waitUntilSettled()` を追加し、保留中のデバウンスが無ければ即座に、あれば次に確定するまで待つ Promise を返す。

**検討した選択肢**:

- **A（採用）: タブイベントをデバウンスに合わせて待たせる**。中間状態のルール値でグループが作られること自体が無くなるため根本原因を断てる。`plan.ts`・`rule-change.ts` は変更不要。影響は「ルール編集中（300ms以内）にタブを開く」という稀な重なりのときだけで、通常のタブ操作に遅延は生じない
- **B: 確定後に既存グループの色も原因を問わず直す**。`plan.ts` の `decideTab` を拡張し、タイトルが一致する既存グループでも色が食い違えば `update-group` を出す。原因を問わず収束する頑健さはあるが、将来「手動でタブグループの色を変える」運用と衝突しうる（今は tab イベントのたびに色を強制していないが、この変更で強制するようになる）。どの経路（ルール変更後だけ／常時）で色を揃えるかの設計をさらに詰める必要があり、既存の挙動への影響範囲が広い
- **C: デバウンスの差分を2点比較でなく累積で追跡する**。理論上どんな経路で中間状態が作られても正しく扱えるが、`debounceChanges`・`diffRules` 双方の実装とテスト（property-based test を含む）が大きく複雑になる

採用した A は、影響範囲が `regroupTab` の呼び出し元（`tabs.onUpdated`・`onAttached`）に限られ、既存のテスト済みの挙動（`plan.ts`・`rule-change.ts`）に触れないため、リスクと実装コストが最も小さいと判断した。

### 待機の上限

**決定**: 上限を設けない。`waitUntilSettled()` は、呼び出し時点で保留中のデバウンスが確定するまでだけ待つ（次に新しく始まるデバウンスは待たない）。ルール編集は通常数秒以内に止まるため、実用上は数百ms程度で解決する想定。

## Risks / Trade-offs

- [リスク] 休みなく連続でルールを編集し続けると、その間タブの判定が遅れ続ける → [軽減] `waitUntilSettled()` は「呼び出し時点で保留中の1回分」だけを待つため、次の編集が増えても待ち時間は際限なく伸びない。実運用でそのような操作は想定しにくい
- [リスク] `debounceChanges` の公開 API（戻り値の形）が変わる → [軽減] 利用箇所は `entrypoints/background/grouping.ts` の1箇所のみで、同じ変更の中で追従する
- [リスク] デバウンスの確定処理（`listener` の呼び出し）が例外を投げると、待機中の `waitUntilSettled()` が解決しなくなる → [軽減] `try/finally` で、例外が起きても待機中の呼び出し元を必ず解決する
