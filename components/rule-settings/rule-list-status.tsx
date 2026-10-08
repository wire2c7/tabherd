import type { JSX } from "preact";

import type { RuleProblem } from "../../utils/rules/match";
import type { Rule } from "../../utils/rules/types";

import { RuleList } from "./rule-list";
import type { RulesLoad } from "./use-rules";

interface RuleListOrStatusProps {
  load: RulesLoad;
  /** load.status === "loaded" のときの load.rules。それ以外は null */
  rules: readonly Rule[] | null;
  retry: () => void;
  problems: readonly (RuleProblem | null)[];
  newRuleId: string | null;
  onUpdate: (id: string, update: (rule: Rule) => Rule) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, to: number) => void;
}

/** 読み込みの状態に応じて、失敗の表示・読み込み中の表示・ルールの一覧のいずれかを表示する */
export function RuleListOrStatus({
  load,
  rules,
  retry,
  problems,
  newRuleId,
  onUpdate,
  onRemove,
  onMove,
}: RuleListOrStatusProps): JSX.Element {
  if (load.status === "failed") {
    return <RuleLoadFailure onRetry={retry} />;
  }
  if (rules === null) {
    return <p class="hint">読み込み中…</p>;
  }
  return (
    <RuleList
      rules={rules}
      problems={problems}
      newRuleId={newRuleId}
      onUpdate={onUpdate}
      onRemove={onRemove}
      onMove={onMove}
    />
  );
}

/** 保存されたルールの読み込みが失敗したときの表示。読み込みをもう一度試すボタンを出す */
function RuleLoadFailure({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <>
      <p class="error" role="alert">
        保存されたルールを読み込めませんでした。
      </p>
      <button type="button" onClick={onRetry}>
        再読み込み
      </button>
    </>
  );
}
