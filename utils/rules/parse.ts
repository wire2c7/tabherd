import { is, object, record, safeParse, string, unknown } from "valibot";

import type { Condition, GroupColor, Rule, RuleTitles } from "./types";
import { ConditionSchema, GroupColorSchema, RuleSchema } from "./types";

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

/** 読めない色の代わりの色 */
const FALLBACK_COLOR: GroupColor = "grey";

/** 直せるルール。id・name が読めれば、色と条件は直して残す */
const RepairableRuleSchema = object({
  id: string(),
  name: string(),
  color: unknown(),
  conditions: unknown(),
});

/**
 * 保存値をルールの一覧に直す。StorageItem は保存した値の形を確かめずに返すため、壊れた値はここで直す。
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
  const valid = safeParse(RuleSchema, value);
  if (valid.success) {
    return { rule: valid.output, repaired: false };
  }
  const repairable = safeParse(RepairableRuleSchema, value);
  if (!repairable.success) {
    return null;
  }
  const { id, name, color, conditions } = repairable.output;
  return {
    rule: {
      id,
      name,
      color: is(GroupColorSchema, color) ? color : FALLBACK_COLOR,
      conditions: Array.isArray(conditions) ? parseConditions(conditions as unknown[]) : [],
    },
    repaired: true,
  };
}

/** 読める条件だけを残す */
function parseConditions(values: readonly unknown[]): Condition[] {
  return values.flatMap((value) => {
    const parsed = safeParse(ConditionSchema, value);
    return parsed.success ? [parsed.output] : [];
  });
}

const RuleTitlesSchema = record(string(), unknown());

/**
 * 保存値を RuleTitles に直す。オブジェクトでなければ、どのルールもタイトルを持っていないものとし、
 * 値が文字列でない項目はその項目だけを除く（次の反映で書き直される）
 */
export function parseRuleTitles(value: unknown): RuleTitles {
  const parsed = safeParse(RuleTitlesSchema, value);
  if (!parsed.success) {
    return new Map();
  }
  return new Map(
    Object.entries(parsed.output).flatMap(([id, title]) => (typeof title === "string" ? [[id, title] as const] : [])),
  );
}
