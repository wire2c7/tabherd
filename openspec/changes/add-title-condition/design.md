# Design

## Context

See proposal.md - Why. 既存の条件（`utils/rules/types.ts` の `ConditionSchema`）は URL のみを対象にしており、`utils/rules/match.ts` の判定関数は URL の文字列だけを受け取る。タブの再判定のトリガーは `entrypoints/background/grouping.ts` の `browser.tabs.onUpdated` で、`changeInfo.url` の変化だけを見ている（`changeInfo.title` は見ていない）。ルール変更の反映には `utils/grouping/debounce.ts` の `debounceChanges`（1つの値の変化をまとめる）がすでにあり、`RULE_CHANGE_DEBOUNCE_MS = 300` で使われている。

## Goals / Non-Goals

**Goals:**

- 条件が URL・タイトルのどちらを対象にするかを選べるようにする
- タブのタイトルが変わったときも、デバウンスを挟んで再判定する
- 既存の保存済みルール（対象の指定がない条件）の挙動を変えない

**Non-Goals:**

- URL・タイトル以外を対象にした条件（例: favicon、ドメインの分解）は扱わない
- 1つの条件で URL とタイトルの両方を同時に判定する（AND）仕組みは作らない。複数対象をまとめたいときは、ルールに複数の条件を追加する（OR）既存の仕組みで表現する

## Decisions

### 条件のスキーマに `target` を追加する

`ConditionSchema` に `target: picklist(["url", "title"])` を追加する。`optional(..., "url")` を使い、保存値に `target` が無ければ `"url"` を補う。これにより、対象の指定がない既存の条件はコード上も自然に URL 条件として扱われる（移行処理は不要）。

`target` の値が `"url"`・`"title"` のどちらでもない壊れた値（例: 任意の文字列）は、`utils/rules/parse.ts` の既存の「読めない色は grey」と同じパターンで、条件自体は残しつつ `target` だけ `"url"` に直す。`ConditionSchema` 自体の `safeParse` が通らない場合に備え、`type`・`value` は読めるが `target` だけ不正な条件を拾う直し用のスキーマ（`RepairableConditionSchema`、`RepairableRuleSchema` と同様の構造）を `parseConditions` に追加する。

**代替案**: `type` を `"contains" | "regex"` のまま、新しく `"title-contains" | "title-regex"` を増やす案もあったが、既存の `type`（判定の種類）と対象を1つの picklist に混ぜると、UI・判定ロジックの両方で「種類」と「対象」の2軸を1つの値から毎回分解する必要があり複雑になるため採らない。`target` を独立したフィールドにする方が、UI の選択欄も種類・対象で2つに分けやすい。

### 判定関数はタブの URL とタイトルの両方を受け取る

`matchesCondition`・`matchesRule`・`findMatchingRule`（`utils/rules/match.ts`）の第1引数を、URL の文字列から `{ url: string; title: string }`（`MatchTarget` 型を追加）に変える。`matchesCondition` は `condition.target` で `url`・`title` のどちらの文字列を見るか切り替える。

呼び出し側（`utils/grouping/regroup.ts` 等、`findMatchingRule` を呼んでいる箇所）は、タブの `title` を渡すように変える。ピン留めされたタブはそもそも判定の対象外（既存仕様）なのでここでは触れない。

### タブのタイトルが未確定のときは空文字列として扱う

`browser.tabs.Tab.title` は、タイトルが決まるまで `undefined` になりうる。`BrowserTab`（`utils/grouping/tabs.ts`）に `title: string` を追加し、`tab.title ?? ""` で取り込む。空文字列はどの条件にも一致しない（既存の「値が空の条件はどの対象にも一致しない」とは別に、`matchesCondition` の対象文字列が空でも、値が空でない限り `"".includes(value)` は value が空でなければ false になるため、追加の分岐は不要）。

### タイトル変化の再判定はタブごとにデバウンスする

`debounceChanges` は1つの値の変化の列をまとめる前提（`RulesState["rules"]` という単一の値に対して1インスタンス）だが、タイトルの変化はタブごとに独立して起こる。タブごとに `debounceChanges<string>` のインスタンスを持つ `Map<tabId, ReturnType<typeof debounceChanges<string>>>` を `regroupOnEvents` 内に持たせ、`changeInfo.title` を受けたタブの `tabId` に対応するインスタンスへ渡す。

タブが閉じられたとき（`browser.tabs.onRemoved`）に対応する `Map` のエントリを削除し、開いたまま閉じられないタブが増えてもマップが際限なく育たないようにする。

デバウンスの時間は、ルール変更用の `RULE_CHANGE_DEBOUNCE_MS`（300ms）とは別の定数 `TITLE_CHANGE_DEBOUNCE_MS` として 500ms を使う。ページ読み込み中のタイトル変化はルール変更の入力よりも連続して起こりやすいため、300ms よりわずかに長くして再判定の回数を抑える。

### 設定画面の UI

`components/rule-settings/condition-editor.tsx` に、既存の「種類」の `<select>` と並べて「対象」の `<select>`（URL・タイトル）を追加する。`CONDITION_TYPE_LABELS` と同様に `CONDITION_TARGET_LABELS` を定義する。正規表現が不正かどうかのバリデーション（`invalidRegex`）は対象に関係なく同じロジックのまま使う。

## Risks / Trade-offs

- [タブごとのデバウンス用 `Map` がタブの増減に追従できないと、閉じたタブのタイマーが残り続ける] → `onRemoved` で確実に削除する。既存の `debounceChanges` 自体は `setTimeout` を1つしか持たないため、エントリを消せばタイマーも消える
- [タイトルが何度も変わるページでは、デバウンスのぶん反映が遅れる] → 許容する（ユーザー承認済みの方針）。遅れは最大で `TITLE_CHANGE_DEBOUNCE_MS` 程度
- [`target` の2値化により、将来 URL・タイトル以外の対象を増やすと `picklist` の変更と判定ロジックの分岐が両方必要になる] → 現時点では Non-Goals としており、必要になった時点で設計し直す

## Migration Plan

保存データの移行処理は不要。`target` 無しの既存条件は読み込み時に `"url"` として扱われ、保存し直すまでは `target` フィールドを持たないまま残るが、動作に影響はない（次にその条件を編集・保存したタイミングで `target: "url"` が書き込まれる）。
