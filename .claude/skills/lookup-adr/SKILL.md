---
name: lookup-adr
description: Answers questions about this repository's current policies and the reasons behind design decisions by searching the ADRs in docs/adr/. Use when the user asks what the current policy/approach is or why something is set up a certain way (e.g. "〜の今の方針ってなんだっけ？", "なぜ〜にしたんだっけ？", "〜は使わないんだっけ？", "〜を採用した理由は？").
---

# ADR から方針・判断理由を調べる

「今の方針」「なぜそうしたか」を、`docs/adr/` の ADR から調べて答える。ADR の規約は `.claude/rules/adr.md` を参照する。

## 手順

1. **ADR を検索する**。質問のキーワードに加え、同義語・英語表記・関連するツール名や設定名でも検索する（例: 「依存の更新」→ `Renovate`・`minimumReleaseAge`・`pnpm`）。

   ```sh
   grep -il -E '<キーワード1>|<キーワード2>' docs/adr/[0-9]*.md
   grep -H -E '^# |^- ステータス' docs/adr/[0-9]*.md | sort   # 全 ADR のタイトルとステータス
   ```

   キーワードでヒットしなくても、タイトルの一覧から関係しそうな ADR を探す。

2. **ヒットした ADR を読み、ステータスを確認する**。
   - `Superseded by NNNN`: 置き換え先の ADR をたどり、`Accepted` のものに行き着くまで繰り返す
   - `Deprecated`: 方針は取りやめられている。取りやめた理由として扱う
   - `Rejected`: 「なぜ〜を使わないのか」への答えとして扱う
   - `Proposed`: 未決定。決定済みの方針として答えない

3. **現在の実装・設定と照合する**。ADR は判断した時点の記録であり、現在の状態の SSoT はソースコード・設定ファイルである。ADR の「決定」に出てくる設定ファイル・設定値を実際に確認する。

4. **回答する**。
   - 現在の方針を先に述べ、理由（ADR の「コンテキスト」「検討した選択肢」「決定」）を要約する。根拠の ADR をパスで示す
   - ADR と現在の設定が食い違っていれば、食い違いを明示する。意図的な変更なら新しい ADR で置き換えるよう提案する
   - 該当する ADR が無ければ、そのことを明示したうえで設定ファイル等から分かる範囲で答え、判断理由が重要なら ADR の追加を提案する。ADR に無い理由を推測で補わない
