import type { InferOutput } from "valibot";
import { array, object, optional, picklist, string } from "valibot";

/**
 * Chrome のタブグループの色。
 *
 * @remarks 並び順は新しいルールの色を選ぶ順番でもある（utils/rules/color.ts の pickNewRuleColor）
 */
export const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const;

export const GroupColorSchema = picklist(GROUP_COLORS);

export type GroupColor = InferOutput<typeof GroupColorSchema>;

/**
 * 条件の対象。
 *
 * @remarks url はタブの URL、title はタブのタイトル
 */
export const ConditionTargetSchema = picklist(["url", "title"]);

export type ConditionTarget = InferOutput<typeof ConditionTargetSchema>;

/** 対象の指定がない条件は URL を対象にした条件として扱う（既存の保存済みルールとの互換のため） */
export const DEFAULT_CONDITION_TARGET: ConditionTarget = "url";

/**
 * 条件の種類。
 *
 * @remarks contains は部分一致、regex は正規表現。target を省略した条件は URL を対象として扱う
 * （DEFAULT_CONDITION_TARGET）。値を読む側は条件自身ではなく conditionTarget 関数を介して対象を読む
 */
export const ConditionSchema = object({
  target: optional(ConditionTargetSchema),
  type: picklist(["contains", "regex"]),
  value: string(),
});

export type Condition = InferOutput<typeof ConditionSchema>;

export type ConditionType = Condition["type"];

/**
 * 条件の対象を読む。
 *
 * @param condition - 対象を読む条件
 * @returns 条件の target。省略されていれば DEFAULT_CONDITION_TARGET
 */
export function conditionTarget(condition: Condition): ConditionTarget {
  return condition.target ?? DEFAULT_CONDITION_TARGET;
}

/**
 * タブをまとめるグループのルール。
 *
 * @remarks 一覧での位置が優先度とタブバー上の並びを表す。保存された値はこのスキーマで確かめる
 * （utils/rules/parse.ts）ため、型はスキーマから作る
 */
export const RuleSchema = object({
  id: string(),
  name: string(),
  color: GroupColorSchema,
  conditions: array(ConditionSchema),
});

export type Rule = InferOutput<typeof RuleSchema>;

/**
 * ルールの ID から、そのルールが持っているグループのタイトル。
 *
 * @remarks Chrome のタブグループには印を付けられないため、グループとルールをタイトルで結び付ける。
 * ルールが無効なあいだは、無効になる前のタイトルを持ち続ける
 */
export type RuleTitles = ReadonlyMap<string, string>;

/** タイトルを持っているルールが無い RuleTitles */
export const NO_TITLES: RuleTitles = new Map();
