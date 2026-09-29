import { pickNewRuleColor } from "../../utils/rules/color";
import type { Condition, Rule } from "../../utils/rules/types";

/** 条件の初期値。追加してすぐ値を入力できるよう、部分一致の空の条件にする */
export function createCondition(): Condition {
  return { type: "contains", value: "" };
}

/** 一覧の末尾にルールを加える。色は既存のルールで使われていないものを選ぶ */
export function addRule(rules: readonly Rule[], id: string): Rule[] {
  return [...rules, { id, name: "", color: pickNewRuleColor(rules), conditions: [createCondition()] }];
}

/** id のルールを update の結果に置き換える */
export function updateRule(rules: readonly Rule[], id: string, update: (rule: Rule) => Rule): Rule[] {
  return rules.map((rule) => (rule.id === id ? update(rule) : rule));
}

export function removeRule(rules: readonly Rule[], id: string): Rule[] {
  return rules.filter((rule) => rule.id !== id);
}

export function addCondition(rule: Rule): Rule {
  return { ...rule, conditions: [...rule.conditions, createCondition()] };
}

/** index 番目の条件を condition に置き換える */
export function updateCondition(rule: Rule, index: number, condition: Condition): Rule {
  return { ...rule, conditions: rule.conditions.map((current, i) => (i === index ? condition : current)) };
}

export function removeCondition(rule: Rule, index: number): Rule {
  return { ...rule, conditions: rule.conditions.filter((_, i) => i !== index) };
}
