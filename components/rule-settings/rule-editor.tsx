import type { JSX } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";
import { is } from "valibot";

import type { RuleProblem } from "../../utils/rules/match";
import type { Condition, GroupColor, Rule } from "../../utils/rules/types";
import { GROUP_COLORS, GroupColorSchema } from "../../utils/rules/types";

import { ConditionEditor } from "./condition-editor";
import { addCondition, removeCondition, updateCondition } from "./edit";
import type { MoveDirection } from "./reorder";

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
  "duplicate-name": "ほかのルールが使っているグループ名です。このルールは使われません",
};

type RuleUpdate = (id: string, update: (rule: Rule) => Rule) => void;

interface Props {
  rule: Rule;
  problem: RuleProblem | null;
  /** 追加された直後のルールか。グループ名の入力欄にフォーカスを移す */
  isNew: boolean;
  onUpdate: RuleUpdate;
  onRemove: (id: string) => void;
  /** 一覧の先頭・末尾か。「上へ」「下へ」のボタンを無効にする */
  isFirst: boolean;
  isLast: boolean;
  onStep: (id: string, direction: MoveDirection) => void;
}

/**
 * 1件のルールの編集欄。
 *
 * @param props - 編集するルール・表示する問題・一覧での位置と、更新・削除・並び替えのハンドラ
 * @returns ルールの編集欄
 */
export function RuleEditor({ rule, problem, isNew, onUpdate, onRemove, isFirst, isLast, onStep }: Props): JSX.Element {
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
      <RuleActions
        id={id}
        name={rule.name}
        isFirst={isFirst}
        isLast={isLast}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onStep={onStep}
      />
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
        onChange(is(GroupColorSchema, value) ? value : color);
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

interface RuleActionsProps {
  id: string;
  name: string;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: RuleUpdate;
  onRemove: (id: string) => void;
  onStep: (id: string, direction: MoveDirection) => void;
}

/** 条件の追加・並び替え・削除のボタン。並び替えのボタンは、移動後にフォーカスを戻すため data-move で探す */
function RuleActions({ id, name, isFirst, isLast, onUpdate, onRemove, onStep }: RuleActionsProps): JSX.Element {
  const target = name === "" ? "名前のないルール" : `「${name}」`;
  return (
    <div class="rule__actions">
      <button type="button" onClick={() => onUpdate(id, addCondition)}>
        ＋ 条件を追加
      </button>
      <div class="rule__buttons">
        <button
          type="button"
          class="icon-button"
          data-move="up"
          aria-label={`${target}を上へ移動`}
          title="上へ移動"
          disabled={isFirst}
          onClick={() => onStep(id, "up")}
        >
          ↑
        </button>
        <button
          type="button"
          class="icon-button"
          data-move="down"
          aria-label={`${target}を下へ移動`}
          title="下へ移動"
          disabled={isLast}
          onClick={() => onStep(id, "down")}
        >
          ↓
        </button>
        <button type="button" class="danger" onClick={() => onRemove(id)}>
          ルールを削除
        </button>
      </div>
    </div>
  );
}
