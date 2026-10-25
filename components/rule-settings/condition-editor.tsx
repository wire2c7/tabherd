import type { JSX } from "preact";

import { isValidRegex } from "../../utils/rules/match";
import type { Condition, ConditionTarget, ConditionType } from "../../utils/rules/types";
import { conditionTarget } from "../../utils/rules/types";

const CONDITION_TYPES: readonly ConditionType[] = ["contains", "regex"];

const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  contains: "部分一致",
  regex: "正規表現",
};

const CONDITION_TARGETS: readonly ConditionTarget[] = ["url", "title"];

const CONDITION_TARGET_LABELS: Record<ConditionTarget, string> = {
  url: "URL",
  title: "タイトル",
};

/** 対象・種類に応じた、値の入力欄のプレースホルダー */
const PLACEHOLDERS: Record<ConditionTarget, Record<ConditionType, string>> = {
  url: { contains: "github.com", regex: String.raw`^https://github\.com/` },
  title: { contains: "Pull Request", regex: String.raw`^\[.+\] ` },
};

interface Props {
  condition: Condition;
  index: number;
  /** 入力欄の id の接頭辞。ルールごとに異なる */
  idPrefix: string;
  onChange: (index: number, condition: Condition) => void;
  onRemove: (index: number) => void;
}

type TargetSelectProps = Pick<Props, "condition" | "index" | "onChange"> & { number: number };

/** 条件の対象（URL・タイトル）の選択欄 */
function TargetSelect({ condition, index, number, onChange }: TargetSelectProps): JSX.Element {
  const target = conditionTarget(condition);
  return (
    <select
      aria-label={`条件 ${number} の対象`}
      value={target}
      onChange={(event) => {
        const { value } = event.currentTarget;
        onChange(index, { ...condition, target: CONDITION_TARGETS.find((t) => t === value) ?? target });
      }}
    >
      {CONDITION_TARGETS.map((conditionTargetOption) => (
        <option key={conditionTargetOption} value={conditionTargetOption}>
          {CONDITION_TARGET_LABELS[conditionTargetOption]}
        </option>
      ))}
    </select>
  );
}

/**
 * 1件の条件（対象・種類・値）の編集欄。
 *
 * @param props - 編集する条件・一覧での位置・入力欄の id の接頭辞と、変更・削除のハンドラ
 * @returns 条件の編集欄
 */
export function ConditionEditor({ condition, index, idPrefix, onChange, onRemove }: Props): JSX.Element {
  // 空の値はどの URL にも一致しないだけで、入力途中でもあるためエラーにしない
  const invalidRegex = condition.type === "regex" && condition.value !== "" && !isValidRegex(condition.value);
  const errorId = `${idPrefix}-error`;
  const number = index + 1;
  const target = conditionTarget(condition);

  return (
    <li class="condition">
      <div class="condition__row">
        <TargetSelect condition={condition} index={index} number={number} onChange={onChange} />
        <select
          aria-label={`条件 ${number} の種類`}
          value={condition.type}
          onChange={(event) => {
            const { value } = event.currentTarget;
            const type = CONDITION_TYPES.find((t) => t === value) ?? condition.type;
            onChange(index, { ...condition, type });
          }}
        >
          {CONDITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {CONDITION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          type="text"
          class="condition__value"
          aria-label={`条件 ${number} の値`}
          aria-invalid={invalidRegex}
          aria-describedby={invalidRegex ? errorId : undefined}
          placeholder={PLACEHOLDERS[target][condition.type]}
          spellcheck={false}
          autocomplete="off"
          value={condition.value}
          onInput={(event) => onChange(index, { ...condition, value: event.currentTarget.value })}
        />
        <button type="button" class="icon-button" aria-label={`条件 ${number} を削除`} onClick={() => onRemove(index)}>
          ×
        </button>
      </div>
      {invalidRegex && (
        <p id={errorId} class="error">
          正規表現の構文が正しくありません
        </p>
      )}
    </li>
  );
}
