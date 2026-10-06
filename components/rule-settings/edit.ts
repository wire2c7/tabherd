import { pickNewRuleColor } from "../../utils/rules/color";
import type { Condition, Rule } from "../../utils/rules/types";

/**
 * 条件の初期値を作る。
 *
 * @returns 部分一致の空の条件
 * @remarks 追加してすぐ値を入力できるよう、部分一致の空の条件にする
 */
export function createCondition(): Condition {
  return { type: "contains", value: "" };
}

/**
 * 一覧の末尾にルールを加える。
 *
 * @param rules - 加える前のルールの一覧
 * @param id - 新しいルールの ID
 * @returns ルールを加えた後の一覧
 * @remarks 色は既存のルールで使われていないものを選ぶ
 */
export function addRule(rules: readonly Rule[], id: string): Rule[] {
  return [...rules, { id, name: "", color: pickNewRuleColor(rules), conditions: [createCondition()] }];
}

/**
 * id のルールを update の結果に置き換える。
 *
 * @param rules - 置き換える前のルールの一覧
 * @param id - 置き換えるルールの ID
 * @param update - 元のルールから新しいルールを作る関数
 * @returns 置き換えた後の一覧
 */
export function updateRule(rules: readonly Rule[], id: string, update: (rule: Rule) => Rule): Rule[] {
  return rules.map((rule) => (rule.id === id ? update(rule) : rule));
}

/**
 * id のルールを一覧から取り除く。
 *
 * @param rules - 取り除く前のルールの一覧
 * @param id - 取り除くルールの ID
 * @returns 取り除いた後の一覧
 */
export function removeRule(rules: readonly Rule[], id: string): Rule[] {
  return rules.filter((rule) => rule.id !== id);
}

/**
 * ルールに条件を加える。
 *
 * @param rule - 加える前のルール
 * @returns 条件を加えた後のルール
 */
export function addCondition(rule: Rule): Rule {
  return { ...rule, conditions: [...rule.conditions, createCondition()] };
}

/**
 * index 番目の条件を condition に置き換える。
 *
 * @param rule - 置き換える前のルール
 * @param index - 置き換える条件の位置
 * @param condition - 新しい条件
 * @returns 置き換えた後のルール
 */
export function updateCondition(rule: Rule, index: number, condition: Condition): Rule {
  return { ...rule, conditions: rule.conditions.map((current, i) => (i === index ? condition : current)) };
}

/**
 * index 番目の条件を取り除く。
 *
 * @param rule - 取り除く前のルール
 * @param index - 取り除く条件の位置
 * @returns 取り除いた後のルール
 */
export function removeCondition(rule: Rule, index: number): Rule {
  return { ...rule, conditions: rule.conditions.filter((_, i) => i !== index) };
}

/**
 * from 番目のルールを、移動後の位置が to 番目になるよう動かす。
 *
 * @param rules - 動かす前のルールの一覧
 * @param from - 動かすルールの元の位置
 * @param to - 動かした後の位置
 * @returns 動かした後の一覧。どちらかが範囲外なら元の並びのまま返す
 */
export function moveRule(rules: readonly Rule[], from: number, to: number): Rule[] {
  const moved = rules[from];
  if (moved === undefined || to < 0 || to >= rules.length) {
    return [...rules];
  }
  const rest = rules.filter((_, i) => i !== from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}
