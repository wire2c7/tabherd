import type { GroupColor, Rule } from "./types";
import { GROUP_COLORS } from "./types";

/**
 * 新しいルールの色を選ぶ。
 *
 * @param rules - 既存のルールの一覧。色の使用状況を調べる対象
 * @returns 既存のルールで使われていない色を GROUP_COLORS の順に選んだもの
 * @remarks grey は目立たないため候補から外し、ほかの色がすべて使われているときだけ使う
 */
export function pickNewRuleColor(rules: readonly Rule[]): GroupColor {
  const used = new Set(rules.map((rule) => rule.color));
  return GROUP_COLORS.find((color) => color !== "grey" && !used.has(color)) ?? "grey";
}
