import type { JSX } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type { RuleProblem } from "../../utils/rules/match";
import type { Condition, GroupColor, Rule } from "../../utils/rules/types";
import { GROUP_COLORS } from "../../utils/rules/types";

import { ConditionEditor } from "./condition-editor";
import { addCondition, removeCondition, updateCondition } from "./edit";

/** Chrome の日本語の表示に合わせた色の名前 */
const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  grey: "グレー",
  blue: "青",
  red: "赤",
  yellow: "黄",
  green: "緑",
  pink: "ピンク",
  purple: "紫",
  cyan: "シアン",
  orange: "オレンジ",
};

const PROBLEM_MESSAGES: Record<RuleProblem, string> = {
  "empty-name": "グループ名を入力してください",
  "duplicate-name": "上のルールと同じグループ名です。このルールは使われません",
};

type RuleUpdate = (id: string, update: (rule: Rule) => Rule) => void;

interface Props {
  rule: Rule;
  problem: RuleProblem | null;
  /** 追加された直後のルールか。グループ名の入力欄にフォーカスを移す */
  isNew: boolean;
  onUpdate: RuleUpdate;
  onRemove: (id: string) => void;
}

export function RuleEditor({ rule, problem, isNew, onUpdate, onRemove }: Props): JSX.Element {
  const { id } = rule;

  const handleConditionChange = useCallback(
    (index: number, condition: Condition) => onUpdate(id, (current) => updateCondition(current, index, condition)),
    [id, onUpdate],
  );
  const handleConditionRemove = useCallback(
    (index: number) => onUpdate(id, (current) => removeCondition(current, index)),
    [id, onUpdate],
  );

  return (
    <article class="rule" aria-label={rule.name === "" ? "名前のないルール" : `ルール「${rule.name}」`}>
      <RuleHeader rule={rule} problem={problem} isNew={isNew} onUpdate={onUpdate} />
      <p class="rule__caption">URL が次のいずれかに一致するタブ</p>
      {rule.conditions.length === 0 ? (
        <p class="hint">条件がないため、どのタブもまとめません</p>
      ) : (
        <ul class="conditions">
          {rule.conditions.map((condition, index) => (
            <ConditionEditor
              // 条件は id を持たないため添字を key にする。入力欄の値は props で制御しているため、削除で添字がずれても表示は食い違わない
              // oxlint-disable-next-line react/no-array-index-key -- 条件は id を持たない（上のコメントを参照）
              key={index}
              condition={condition}
              index={index}
              idPrefix={`rule-${id}-condition-${index}`}
              onChange={handleConditionChange}
              onRemove={handleConditionRemove}
            />
          ))}
        </ul>
      )}
      <div class="rule__actions">
        <button type="button" onClick={() => onUpdate(id, addCondition)}>
          ＋ 条件を追加
        </button>
        <button type="button" class="danger" onClick={() => onRemove(id)}>
          ルールを削除
        </button>
      </div>
    </article>
  );
}

interface RuleHeaderProps {
  rule: Rule;
  problem: RuleProblem | null;
  isNew: boolean;
  onUpdate: RuleUpdate;
}

/** グループ名・色の入力欄と、グループ名のエラー */
function RuleHeader({ rule, problem, isNew, onUpdate }: RuleHeaderProps): JSX.Element {
  const { id } = rule;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const errorId = `rule-${id}-name-error`;
  const handleColorChange = useCallback(
    (color: GroupColor) => onUpdate(id, (current) => ({ ...current, color })),
    [id, onUpdate],
  );

  useEffect(() => {
    if (isNew) {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isNew]);

  return (
    <>
      <div class="rule__header">
        <span class="swatch" data-color={rule.color} aria-hidden="true" />
        <input
          ref={nameInputRef}
          type="text"
          class="rule__name"
          aria-label="グループ名"
          placeholder="グループ名"
          autocomplete="off"
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : errorId}
          value={rule.name}
          onInput={(event) => {
            const name = event.currentTarget.value;
            onUpdate(id, (current) => ({ ...current, name }));
          }}
        />
        <ColorSelect color={rule.color} onChange={handleColorChange} />
      </div>
      {problem !== null && (
        <p id={errorId} class="error">
          {PROBLEM_MESSAGES[problem]}
        </p>
      )}
    </>
  );
}

interface ColorSelectProps {
  color: GroupColor;
  onChange: (color: GroupColor) => void;
}

function ColorSelect({ color, onChange }: ColorSelectProps): JSX.Element {
  return (
    <select
      aria-label="グループの色"
      value={color}
      onChange={(event) => {
        const { value } = event.currentTarget;
        onChange(GROUP_COLORS.find((c) => c === value) ?? color);
      }}
    >
      {GROUP_COLORS.map((c) => (
        <option key={c} value={c}>
          {GROUP_COLOR_LABELS[c]}
        </option>
      ))}
    </select>
  );
}
