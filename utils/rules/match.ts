import type { Condition, Rule } from "./types";

/** u フラグ付きの正規表現として解釈できるか。空文字列は条件として意味を持たないため不正とする */
export function isValidRegex(pattern: string): boolean {
  return compileRegex(pattern) !== null;
}

// u フラグは Unicode の文字を正しく扱うため。i・g 等のほかのフラグは付けない（大文字・小文字を区別し、lastIndex を持たせない）
function compileRegex(pattern: string): RegExp | null {
  if (pattern === "") {
    return null;
  }
  try {
    return new RegExp(pattern, "u");
  } catch {
    return null;
  }
}

/** URL が条件に一致するか。値が空・正規表現の構文が不正な条件はどの URL にも一致しない */
export function matchesCondition(url: string, condition: Condition): boolean {
  if (condition.value === "") {
    return false;
  }
  switch (condition.type) {
    case "contains": {
      return url.toLowerCase().includes(condition.value.toLowerCase());
    }
    case "regex": {
      return compileRegex(condition.value)?.test(url) ?? false;
    }
    default: {
      return false;
    }
  }
}

/** URL がルールの条件のいずれかに一致するか */
export function matchesRule(url: string, rule: Rule): boolean {
  return rule.conditions.some((condition) => matchesCondition(url, condition));
}

/** ルールが無効になる理由。empty-name は空のグループ名、duplicate-name は上のルールとの名前の重複 */
export type RuleProblem = "empty-name" | "duplicate-name";

/** ルールの一覧のそれぞれについて、無効になる理由を返す（有効なら null）。返す配列の添字は rules と対応する */
export function findRuleProblems(rules: readonly Rule[]): (RuleProblem | null)[] {
  const seen = new Set<string>();
  return rules.map((rule) => {
    if (rule.name.trim() === "") {
      return "empty-name";
    }
    if (seen.has(rule.name)) {
      return "duplicate-name";
    }
    seen.add(rule.name);
    return null;
  });
}

/** 判定の対象になる有効なルールだけを、一覧の順のまま返す */
export function validRules(rules: readonly Rule[]): Rule[] {
  const problems = findRuleProblems(rules);
  return rules.filter((_, index) => problems[index] === null);
}

/** URL が一致するルールを返す。複数に一致するときは一覧で最も上のもの、どれにも一致しなければ null */
export function findMatchingRule(url: string, rules: readonly Rule[]): Rule | null {
  return validRules(rules).find((rule) => matchesRule(url, rule)) ?? null;
}
