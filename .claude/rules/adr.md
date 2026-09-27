---
paths:
  - "docs/adr/*.md"
---

# ADR 規約

`docs/adr/` には、設計判断とその理由を ADR（Architecture Decision Record）として記録する。

## 書き方

- 新しい ADR は `docs/adr/_template.md` をコピーし、`NNNN-<kebab-case のタイトル>.md` という名前で作る（`NNNN` は4桁の連番）。ステータスに取りうる値は `_template.md` にある
- ADR は判断した時点の記録であり、`AGENTS.md` 等と違って実装に追従させない（`.claude/rules/docs.md` の SSoT の原則の対象外）
- `Accepted` になった ADR の本文は書き換えない。判断を変える場合は新しい ADR を作り、古い ADR のステータスを `Superseded by NNNN` に変える
- 誤字の修正やリンクの追加など、判断の内容が変わらない修正は直接行ってよい
- ADR の一覧は作らない（ファイル名とステータスが SSoT。一覧を置くと、追加・ステータス変更のたびに食い違いが生じる）
