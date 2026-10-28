# 0027. 初回インストール時にサンプルルールを投入する

- ステータス：Accepted
- 日付：2026-10-29
- 関連 Issue：#108

## コンテキスト

拡張機能をインストールした直後はルールが1件も無く、ユーザーは自分でルールを作るまで自動グルーピングの効果を体験できない。初回インストール時に3件のサンプルルール（設定・動画・ブログ）を投入し、インストール直後から機能を体験できるようにしたい。

これは、既存の仕様（`openspec/specs/grouping-rules/spec.md` の「ルールの保存」要件のシナリオ「初回インストール時」）が「空の一覧が返る」と明記しているのと矛盾する意図的な変更であり、投入のタイミング・既存のストレージ抽象の再利用方法について判断が要る。

## 検討した選択肢

- **A. `browser.runtime.onInstalled` の `reason === "install"` かつルールが0件のときにだけ投入する（採用）**：既存の `rulesReader`／`RulesStore` の抽象をそのまま使い、新しい保存の仕組みを作らずに済む。アップデート時やルールを全部消した後には再投入されない
- **B. ルールが0件であれば、理由を問わず読み込みのたびに投入する**：ユーザーが意図的にルールを全部消した状態を「初回」と誤認し、毎回サンプルルールが復活してしまう
- **C. 初回インストールフラグを別途ストレージに持ち、フラグが無いときだけ投入する**：`reason === "install"` は Chrome が保証する同等の情報であり、別のフラグを二重に持つ理由が無い

## 決定

選択肢Aを採用する。`entrypoints/background/rules.ts` に書き込み用の `rulesStore`（既存の `createRulesStore(defineStorageItem(RULES_ITEM))`）を新たにエクスポートし、同じファイルに `seedSampleRulesOnFirstInstall(reason)` を実装する。この関数は `reason !== "install"` または `rulesReader.read()` が1件以上返したときは何もしない。

サンプルルールの生成自体（`createSampleRules()`）は `utils/rules/seed.ts` に置き、ID 生成（`crypto.randomUUID()`）と色の割り当て（既存の `pickNewRuleColor`）を使う。`entrypoints/background/grouping.ts` の `onInstalled` リスナーは、`seedSampleRulesOnFirstInstall(details.reason)` を呼んでから `regroupAll()` を呼ぶ処理を1つにまとめて `enqueue` へ積む。投入とその後の `regroupAll` の順序は、同じキュー項目にすることで `enqueue` の直列実行にそのまま委ね、キューの実装詳細に依存した前提を増やさない。

投入するサンプルルールは次の3件とする。

1. `⚙設定` — URL の部分一致 `chrome://`
2. `📺️動画` — URL の部分一致 `youtube.com` / `nicovideo.jp` / `netflix.com` / `twitch.tv`（OR条件）
3. `📃ブログ` — タイトルの部分一致 `ブログ` / URL の部分一致 `blog`（OR条件）

## 結果

- インストール直後からサンプルルールが有効になり、拡張機能の効果をすぐに体験できる
- `openspec/specs/grouping-rules/spec.md` の「初回インストール時」シナリオを、この挙動に合わせて更新する
- `rulesStore`（書き込み用）が `entrypoints/background/rules.ts` から新たに公開されるが、参照するのは同じ background 内の `grouping.ts` のみで、UI 側（`components/`）は従来どおり `utils/rules` の抽象だけを通す
