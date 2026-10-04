# 0020. 保存したデータの形を valibot のスキーマで確かめる

- ステータス：Accepted
- 日付：2026-10-04
- 関連 Issue：#56

## コンテキスト

`chrome.storage.local` に保存したルールの形が壊れていると（例：ルールの `conditions` が `null`）、background のグループ化と設定画面の描画が例外で失敗していた（#56）。WXT の storage（`storage.defineItem`）は、保存値が `null`・`undefined` なら fallback を返すが、それ以外の値は形を確かめずに型付きで返す。保存データの破損や、データの形を変えた版からの巻き戻しで起こりうる。

前提と制約:

- 壊れたルールは丸ごと捨てず、読める部分を残す（ルール単位・条件単位で確かめ、色は grey で補う）。検証の結果は「通ったか」だけでなく、どこが読めなかったかを項目ごとに使う
- ルールの形は `id`・`name`・`color`・`conditions`（条件は `type`・`value`）と小さい
- 保存したログは、配列かどうかだけを `Array.isArray` で確かめている（`utils/logging/storage.ts`。#53）
- 依存は pnpm の `minimumReleaseAge`・`trustPolicy` で審査している（ADR 0006）。拡張機能の API は最低の Chrome 140 で使えるものに限る（ADR 0019）

## 検討した選択肢

サイズは、このリポジトリの `pnpm build` の出力（minify 後）の増分。

- **valibot**：依存なし。関数ごとに import するため、使った分だけがバンドルに入る（全体は minify 後に約 85 kB だが、`background.js` の増分は約 4 kB）。スキーマから型（`InferOutput`）を作れる
- **zod（v4）**：依存なし。スキーマから型を作れる。このリポジトリでは試しておらず、サイズは測っていない
- **手書きの型ガード**：依存なし、増分は最小。型（`Rule`）と検証が別々になり、型に省略できる項目を足したときに検証を直し忘れても、型チェックで見つからない

## 決定

保存したデータの形の検証には valibot を使う。ルールの型（`Rule`・`Condition`・`GroupColor`）は `utils/rules/types.ts` のスキーマから作り、型と検証を1か所にまとめる。

- 理由：型と検証がずれない。関数ごとの import で、増えるのは使う検証の分だけになる
- 壊れたデータを直す規則（何を捨て、何で補うか）は、スキーマの外の関数（`utils/rules/parse.ts`）に書く。スキーマは「正しい形」だけを表す

## 結果

- 保存するデータの形を変えるときは、`types.ts` のスキーマを変えれば型も変わる。保存値の移行は、これまでどおり WXT の `version` と migrations で行う
- 拡張機能のサイズは、`background.js`・設定画面のチャンクとも minify 後に約 4 kB 増える
- 保存したログ（`utils/logging/storage.ts`）は配列かどうかだけを確かめており、今回は valibot に替えない。ほかの保存データに形の検証を足すときも valibot を使う
- valibot の更新は、ほかの依存と同じく Renovate の PR で行う
