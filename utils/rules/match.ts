import type { Condition, Rule, RuleTitles } from "./types";
import { NO_TITLES } from "./types";

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

/** ルールが無効になる理由。empty-name は空のグループ名、duplicate-name はほかのルールが使っているグループ名 */
export type RuleProblem = "empty-name" | "duplicate-name";

/**
 * ルールの一覧のそれぞれについて、無効になる理由を返す（有効なら null）。返す配列の添字は rules と対応する。
 * グループ名が、ほかのルールが titles で持っているタイトル（無効なあいだ持ち続けるものを含む）と同じルールは無効にする。
 * 後から同じ名前にしたルールのために、すでにあるグループのタイトルを別のルールのものにしないため。
 * どのルールも持っていない名前が重なったときは、一覧で最も上のルールを有効にする
 */
export function findRuleProblems(rules: readonly Rule[], titles: RuleTitles = NO_TITLES): (RuleProblem | null)[] {
  const holderByTitle = new Map<string, Rule>();
  const firstByName = new Map<string, Rule>();
  for (const rule of rules) {
    const title = titles.get(rule.id);
    if (title !== undefined && !holderByTitle.has(title)) {
      holderByTitle.set(title, rule);
    }
    if (!firstByName.has(rule.name)) {
      firstByName.set(rule.name, rule);
    }
  }
  return rules.map((rule) => {
    if (rule.name.trim() === "") {
      return "empty-name";
    }
    const chosen = holderByTitle.get(rule.name) ?? firstByName.get(rule.name);
    return chosen === rule ? null : "duplicate-name";
  });
}

/** 判定の対象になる有効なルールだけを、一覧の順のまま返す */
export function validRules(rules: readonly Rule[], titles: RuleTitles = NO_TITLES): Rule[] {
  const problems = findRuleProblems(rules, titles);
  return rules.filter((_, index) => problems[index] === null);
}

/**
 * 無効なルールが持ち続けるタイトルを、ルールの ID ごとに返す。
 * 記録が食い違っていて有効なルールの名前と同じタイトルを持っていれば、有効なルールのグループとして扱うため除く
 */
export function heldTitles(rules: readonly Rule[], titles: RuleTitles): Map<string, string> {
  const problems = findRuleProblems(rules, titles);
  const validNames = new Set(rules.filter((_, index) => problems[index] === null).map((rule) => rule.name));
  const held = new Map<string, string>();
  for (const [index, rule] of rules.entries()) {
    const title = titles.get(rule.id);
    if (problems[index] !== null && title !== undefined && !validNames.has(title)) {
      held.set(rule.id, title);
    }
  }
  return held;
}

/** ルールの一覧の順に、並べるグループのタイトルを返す。有効なルールは名前、無効なルールは持ち続けるタイトル */
export function groupTitlesInOrder(rules: readonly Rule[], titles: RuleTitles = NO_TITLES): string[] {
  const problems = findRuleProblems(rules, titles);
  const held = heldTitles(rules, titles);
  return rules.flatMap((rule, index) => {
    if (problems[index] === null) {
      return [rule.name];
    }
    const title = held.get(rule.id);
    return title === undefined ? [] : [title];
  });
}

/** URL が一致するルールを返す。複数に一致するときは一覧で最も上のもの、どれにも一致しなければ null */
export function findMatchingRule(url: string, rules: readonly Rule[]): Rule | null {
  return validRules(rules).find((rule) => matchesRule(url, rule)) ?? null;
}
