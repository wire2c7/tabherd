import type { JSX } from "preact";

import { isValidRegex } from "../../utils/rules/match";
import type { Condition, ConditionType } from "../../utils/rules/types";

const CONDITION_TYPES: readonly ConditionType[] = ["contains", "regex"];

const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  contains: "部分一致",
  regex: "正規表現",
};

interface Props {
  condition: Condition;
  index: number;
  /** 入力欄の id の接頭辞。ルールごとに異なる */
  idPrefix: string;
  onChange: (index: number, condition: Condition) => void;
  onRemove: (index: number) => void;
}

/**
 * 1件の条件（種類・値）の編集欄。
 *
 * @param props - 編集する条件・一覧での位置・入力欄の id の接頭辞と、変更・削除のハンドラ
 * @returns 条件の編集欄
 */
export function ConditionEditor({ condition, index, idPrefix, onChange, onRemove }: Props): JSX.Element {
  // 空の値はどの URL にも一致しないだけで、入力途中でもあるためエラーにしない
  const invalidRegex = condition.type === "regex" && condition.value !== "" && !isValidRegex(condition.value);
  const errorId = `${idPrefix}-error`;
  const number = index + 1;

  return (
    <li class="condition">
      <div class="condition__row">
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
          placeholder={condition.type === "regex" ? String.raw`^https://github\.com/` : "github.com"}
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
