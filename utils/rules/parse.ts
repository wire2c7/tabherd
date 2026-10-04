import type { Condition, GroupColor, Rule } from "./types";
import { GROUP_COLORS } from "./types";

/** 保存値を読むときに見つかった壊れた箇所。どれも無ければ壊れていない */
export interface RulesDamage {
  /** 保存値が配列でなかった */
  notArray: boolean;
  /** 読めないため除いたルールの件数 */
  droppedRules: number;
  /** 一部を直して残したルールの件数 */
  repairedRules: number;
}

export interface ParsedRules {
  rules: Rule[];
  /** 壊れていなければ null */
  damage: RulesDamage | null;
}

/**
 * 保存値をルールの一覧に直す。WXT の storage は保存した値の形を確かめずに返すため、壊れた値はここで直す。
 * 読めないルール・条件は除き、読めない条件の一覧は空に、読めない色は grey にする。型に無いプロパティは捨てるが、壊れていたことには数えない
 */
export function parseRules(value: unknown): ParsedRules {
  if (!Array.isArray(value)) {
    return { rules: [], damage: { notArray: true, droppedRules: 0, repairedRules: 0 } };
  }
  const rules: Rule[] = [];
  const ids = new Set<string>();
  let droppedRules = 0;
  let repairedRules = 0;
  for (const item of value as unknown[]) {
    const parsed = parseRule(item);
    // 設定画面の編集・並び替えは id でルールを特定するため、同じ id は残せない
    if (parsed === null || ids.has(parsed.rule.id)) {
      droppedRules += 1;
    } else {
      ids.add(parsed.rule.id);
      rules.push(parsed.rule);
      if (parsed.repaired) {
        repairedRules += 1;
      }
    }
  }
  const damage = droppedRules > 0 || repairedRules > 0 ? { notArray: false, droppedRules, repairedRules } : null;
  return { rules, damage };
}

/** 1つのルールを読む。id・name が読めなければ null。repaired は一部を直したか */
function parseRule(value: unknown): { rule: Rule; repaired: boolean } | null {
  if (!isRecord(value) || typeof value["id"] !== "string" || typeof value["name"] !== "string") {
    return null;
  }
  const color = parseColor(value["color"]);
  const rawConditions = value["conditions"];
  const conditions = Array.isArray(rawConditions)
    ? (rawConditions as unknown[])
        .map((condition) => parseCondition(condition))
        .filter((condition) => condition !== null)
    : [];
  const repaired =
    color === null || !Array.isArray(rawConditions) || conditions.length !== (rawConditions as unknown[]).length;
  return {
    rule: { id: value["id"], name: value["name"], color: color ?? GROUP_COLORS[0], conditions },
    repaired,
  };
}

function parseCondition(value: unknown): Condition | null {
  if (!isRecord(value)) {
    return null;
  }
  const { type, value: conditionValue } = value;
  return (type === "contains" || type === "regex") && typeof conditionValue === "string"
    ? { type, value: conditionValue }
    : null;
}

function parseColor(value: unknown): GroupColor | null {
  return GROUP_COLORS.find((color) => color === value) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
