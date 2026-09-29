import type { JSX } from "preact";
import { useCallback, useMemo, useState } from "preact/hooks";

import { findRuleProblems } from "../../utils/rules/match";
import type { Rule } from "../../utils/rules/types";

import { addRule, removeRule, updateRule } from "./edit";
import { RuleEditor } from "./rule-editor";
import { useRules } from "./use-rules";

import "./rule-settings.css";

/** ルールの設定画面。ポップアップとオプションページの両方で描画する */
export function RuleSettings(): JSX.Element {
  const [rules, update] = useRules();
  const [newRuleId, setNewRuleId] = useState<string | null>(null);

  const handleUpdate = useCallback(
    (id: string, updateOne: (rule: Rule) => Rule) => update((current) => updateRule(current, id, updateOne)),
    [update],
  );
  const handleRemove = useCallback((id: string) => update((current) => removeRule(current, id)), [update]);

  function handleAdd(): void {
    const id = crypto.randomUUID();
    update((current) => addRule(current, id));
    setNewRuleId(id);
  }

  return (
    <div class="rule-settings">
      <p class="rule-settings__description">
        URL が条件に一致するタブを、ルールのグループ名のタブグループへ自動でまとめます。
        複数のルールに一致するときは上のルールが優先されます。
        ルールと同じ名前のタブグループは、手で作ったものもそのルールのグループとして扱います。
      </p>
      {rules === null ? (
        <p class="hint">読み込み中…</p>
      ) : (
        <RuleList rules={rules} newRuleId={newRuleId} onUpdate={handleUpdate} onRemove={handleRemove} />
      )}
      <div class="rule-settings__footer">
        <button type="button" class="primary" disabled={rules === null} onClick={handleAdd}>
          ＋ ルールを追加
        </button>
      </div>
    </div>
  );
}

interface RuleListProps {
  rules: readonly Rule[];
  newRuleId: string | null;
  onUpdate: (id: string, update: (rule: Rule) => Rule) => void;
  onRemove: (id: string) => void;
}

/** ルールの一覧。一覧の順が優先度とタブバー上の並びを表す */
function RuleList({ rules, newRuleId, onUpdate, onRemove }: RuleListProps): JSX.Element {
  const problems = useMemo(() => findRuleProblems(rules), [rules]);

  if (rules.length === 0) {
    return <p class="rule-settings__empty">ルールがありません。「ルールを追加」からルールを作ってください。</p>;
  }
  return (
    <ol class="rule-settings__list">
      {rules.map((rule, index) => (
        <li key={rule.id} class="rule-settings__item">
          <RuleEditor
            rule={rule}
            problem={problems[index] ?? null}
            isNew={rule.id === newRuleId}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        </li>
      ))}
    </ol>
  );
}
