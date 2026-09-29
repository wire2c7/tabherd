/** Chrome のタブグループの色。並び順は新しいルールの色を選ぶ順番でもある */
export const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

/** 条件の種類。contains は URL の部分一致、regex は正規表現 */
export type ConditionType = "contains" | "regex";

export interface Condition {
  type: ConditionType;
  value: string;
}

/** タブをまとめるグループのルール。一覧での位置が優先度とタブバー上の並びを表す */
export interface Rule {
  id: string;
  name: string;
  color: GroupColor;
  conditions: Condition[];
}
