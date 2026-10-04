import type { InferOutput } from "valibot";
import { array, object, picklist, string } from "valibot";

/** Chrome のタブグループの色。並び順は新しいルールの色を選ぶ順番でもある */
export const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const;

export const GroupColorSchema = picklist(GROUP_COLORS);

export type GroupColor = InferOutput<typeof GroupColorSchema>;

/** 条件の種類。contains は URL の部分一致、regex は正規表現 */
export const ConditionSchema = object({
  type: picklist(["contains", "regex"]),
  value: string(),
});

export type Condition = InferOutput<typeof ConditionSchema>;

export type ConditionType = Condition["type"];

/**
 * タブをまとめるグループのルール。一覧での位置が優先度とタブバー上の並びを表す。
 * 保存された値はこのスキーマで確かめる（utils/rules/parse.ts）ため、型はスキーマから作る
 */
export const RuleSchema = object({
  id: string(),
  name: string(),
  color: GroupColorSchema,
  conditions: array(ConditionSchema),
});

export type Rule = InferOutput<typeof RuleSchema>;
