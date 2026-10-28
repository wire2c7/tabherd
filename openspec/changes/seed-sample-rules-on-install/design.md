# Design

## Context

- `entrypoints/background/rules.ts` は `rulesReader`（読み取り専用の `RulesReader`）だけを公開しており、書き込み用の `RulesStore`（`createRulesStore` が返す、`.write()` を持つもの）は公開していない
- `entrypoints/background/grouping.ts` の `regroupOnEvents()` 内の `browser.runtime.onInstalled` リスナーは、`details.reason` を見ずに常に `void enqueue(regroupAll)` を呼ぶだけで、`regroupAll` は `readRulesState()` でストレージから毎回読み直す（キャッシュは無い）
- `enqueue`（`createSerialQueue()`）は渡されたタスクを直列に実行するキューで、`void enqueue(fn)` は完了を待たずに積むだけ
- ルールの ID は UI 側（`components/rule-settings/rule-settings.tsx`）で `crypto.randomUUID()` により生成している

## Goals / Non-Goals

**Goals:**

- 初回インストール時だけ、サンプルルール3件を確実に `regroupAll` の実行前に保存する
- 既存のルール読み書きの抽象（`RulesStore`）をそのまま再利用し、新しい保存の仕組みを作らない

**Non-Goals:**

- サンプルルールの内容をユーザーが後から選べるようにする設定 UI は作らない（固定の3件を投入するだけ）
- 既存ルールとのマージや重複排除は扱わない（投入条件は「ルールが0件のとき」のみなので発生しない）

## Decisions

- **書き込み用ストアの公開場所**: `entrypoints/background/rules.ts` に、既存の `rulesReader` と同様の構成で書き込み用の `rulesStore`（`createRulesStore(defineStorageItem(RULES_ITEM))`）をエクスポートする。理由: ストレージの実体（`RULES_ITEM`）とコンストラクタ（`createRulesStore`）は既にこのファイルが把握しており、重複した `StorageItem` を作らずに済む
- **サンプルルールの定義場所**: `utils/rules/seed.ts` に `createSampleRules(): Rule[]` を追加する。`utils/` はブラウザ API を使わない純粋なロジックを置く場所という ADR 0021 の方針に合わせ、ID 生成（`crypto.randomUUID()`）と色の割り当て（既存の `pickNewRuleColor`）をこの関数の中で行う
- **投入のタイミングと順序保証**: `grouping.ts` の `onInstalled` リスナー内で、`details.reason === "install"` のときに `rulesReader.read()` でルールを読み、0件なら `rulesStore.write(createSampleRules())` を `await` してから `enqueue(regroupAll)` を呼ぶ。`enqueue` 自体は直列実行を保証するキューだが、投入処理をキューに積む設計にすると「投入が完了するまで `regroupAll` を呼ばない」という順序をキューの実装に依存させてしまうため、同じリスナー内で素直に `await` してから `enqueue(regroupAll)` を呼ぶ方が読みやすく、依存も増えない
- **「既にルールがあるか」の判定**: `rulesReader.read()`（壊れた保存値を直してから返す、既存の壊れたルール検出の仕組みをそのまま使う）の結果が空配列かどうかで判定する。これにより、壊れたルールが保存されている状態を「0件」と誤判定しない

## Risks / Trade-offs

- [`onInstalled` は `reason` を問わず毎回 `regroupAll` を enqueue しているため、投入処理を `await` で待ってから `enqueue` する変更により、インストール直後のタブの初回グルーピングがサンプルルール投入分（ストレージへの1回の書き込み）だけ遅延する] → 数十ms 程度の遅延であり、ユーザー体験上は無視できる
- [`rulesStore` を新たに `rules.ts` からエクスポートすることで、本来 background 内部に閉じていた書き込み用ストアが他モジュールから参照可能になる] → export 先は `grouping.ts` のみで、UI 側（`components/`）からは既存どおり `utils/rules` の抽象だけを通す。新たな漏れは生じない
