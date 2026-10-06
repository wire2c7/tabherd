import { describe, expect, it } from "vitest";

import {
  findMatchingRule,
  findRuleProblems,
  groupTitlesInOrder,
  heldTitles,
  isValidRegex,
  matchesCondition,
  validRules,
} from "./match";
import type { Condition, Rule } from "./types";

function rule(name: string, conditions: Condition[]): Rule {
  return { id: name, name, color: "blue", conditions };
}

function contains(value: string): Condition {
  return { type: "contains", value };
}

function regex(value: string): Condition {
  return { type: "regex", value };
}

describe("部分一致の条件", () => {
  it("値が URL に含まれるとき一致する", () => {
    expect(matchesCondition("https://github.com/wire2c7/tabherd", contains("github.com"))).toBe(true);
  });

  it("値が URL に含まれないとき一致しない", () => {
    expect(matchesCondition("https://gitlab.com/", contains("github.com"))).toBe(false);
  });

  it("大文字・小文字を区別しない", () => {
    expect(matchesCondition("https://github.com/", contains("GitHub.com"))).toBe(true);
    expect(matchesCondition("https://GITHUB.com/", contains("github.com"))).toBe(true);
  });

  it("値が空のときどの URL にも一致しない", () => {
    expect(matchesCondition("https://github.com/", contains(""))).toBe(false);
  });
});

describe("正規表現の条件", () => {
  it("パターンが URL のどこかに見つかれば一致する", () => {
    expect(matchesCondition("https://docs.example.com/guide", regex(String.raw`^https://[^/]+\.example\.com/`))).toBe(
      true,
    );
  });

  it("一致しない URL には一致しない", () => {
    expect(matchesCondition("https://example.org/", regex(String.raw`^https://[^/]+\.example\.com/`))).toBe(false);
  });

  it("大文字・小文字を区別する", () => {
    expect(matchesCondition("https://GitHub.com/", regex("github"))).toBe(false);
  });

  it("構文が不正な値は例外を出さずに一致しない", () => {
    expect(() => matchesCondition("https://example.com/", regex("("))).not.toThrow();
    expect(matchesCondition("https://example.com/", regex("("))).toBe(false);
  });

  it("値が空のときどの URL にも一致しない", () => {
    expect(matchesCondition("https://example.com/", regex(""))).toBe(false);
  });
});

describe("正規表現の構文の検証", () => {
  it("構文が正しい正規表現は有効", () => {
    expect(isValidRegex(String.raw`^https://example\.com/`)).toBe(true);
  });

  it("構文が不正な正規表現は無効", () => {
    expect(isValidRegex("(")).toBe(false);
    expect(isValidRegex("[a-")).toBe(false);
  });

  it("空文字列は無効", () => {
    expect(isValidRegex("")).toBe(false);
  });
});

describe("ルールの無効になる理由", () => {
  it("有効なルールは null になる", () => {
    expect(findRuleProblems([rule("開発", []), rule("資料", [])])).toStrictEqual([null, null]);
  });

  it("空のグループ名は empty-name になる（前後の空白を除いて判定する）", () => {
    expect(findRuleProblems([rule("", []), rule("  ", [])])).toStrictEqual(["empty-name", "empty-name"]);
  });

  it("上のルールと同じグループ名は duplicate-name になる", () => {
    expect(findRuleProblems([rule("開発", []), rule("資料", []), rule("開発", [])])).toStrictEqual([
      null,
      null,
      "duplicate-name",
    ]);
  });
});

describe("タイトルを持っているルールの優先", () => {
  const upper: Rule = { id: "upper", name: "業務", color: "blue", conditions: [] };
  const lower: Rule = { id: "lower", name: "業務", color: "red", conditions: [] };

  it("下のルールがその名前のタイトルを持っていれば、後から同じ名前にした上のルールが duplicate-name になる", () => {
    expect(findRuleProblems([upper, lower], new Map([["lower", "業務"]]))).toStrictEqual(["duplicate-name", null]);
  });

  it("名前を空にしたルールが持ち続けるタイトルと同じ名前のルールは duplicate-name になる", () => {
    const emptied: Rule = { id: "emptied", name: "", color: "blue", conditions: [] };
    expect(findRuleProblems([emptied, lower], new Map([["emptied", "業務"]]))).toStrictEqual([
      "empty-name",
      "duplicate-name",
    ]);
  });

  it("一覧に無いルールのタイトルは数えない", () => {
    expect(findRuleProblems([upper], new Map([["deleted", "業務"]]))).toStrictEqual([null]);
  });
});

describe("名前の入れ替え", () => {
  it("互いに相手の持っているタイトルを名前にしたルールは、どちらも有効になる", () => {
    const dev: Rule = { id: "dev", name: "資料", color: "blue", conditions: [] };
    const docs: Rule = { id: "docs", name: "開発", color: "green", conditions: [] };
    const titles = new Map([
      ["dev", "開発"],
      ["docs", "資料"],
    ]);
    expect(findRuleProblems([dev, docs], titles)).toStrictEqual([null, null]);
  });

  it("相手が自分の名前のタイトルを持ったままなら、入れ替えではなく後から同じ名前にした方が無効になる", () => {
    const dev: Rule = { id: "dev", name: "資料", color: "blue", conditions: [] };
    const docs: Rule = { id: "docs", name: "資料", color: "green", conditions: [] };
    const titles = new Map([
      ["dev", "開発"],
      ["docs", "資料"],
    ]);
    expect(findRuleProblems([dev, docs], titles)).toStrictEqual(["duplicate-name", null]);
  });
});

describe("無効なルールが持ち続けるタイトル", () => {
  const dev: Rule = { id: "dev", name: "", color: "blue", conditions: [] };
  const docs: Rule = { id: "docs", name: "資料", color: "green", conditions: [] };
  const titles = new Map([
    ["dev", "開発"],
    ["docs", "資料"],
  ]);

  it("無効なルールのタイトルだけを返す", () => {
    expect(heldTitles([dev, docs], titles)).toStrictEqual(new Map([["dev", "開発"]]));
  });

  it("並べるタイトルは、無効なルールの持ち続けるタイトルをルールの位置に含める", () => {
    expect(groupTitlesInOrder([dev, docs], titles)).toStrictEqual(["開発", "資料"]);
  });

  it("タイトルを持っていない無効なルールは並べるタイトルに含めない", () => {
    expect(groupTitlesInOrder([dev, docs])).toStrictEqual(["資料"]);
  });
});

describe("有効なルールの抽出", () => {
  it("無効なルールを除き、一覧の順を保つ", () => {
    const rules = [rule("開発", []), rule("", []), rule("資料", []), rule("開発", [])];
    expect(validRules(rules).map((r) => r.name)).toStrictEqual(["開発", "資料"]);
  });
});

describe("一致するルールの決定", () => {
  it("条件のいずれか1つに一致すれば一致する", () => {
    const rules = [rule("開発", [contains("github.com"), contains("gitlab.com")])];
    expect(findMatchingRule("https://gitlab.com/", rules)?.name).toBe("開発");
  });

  it("複数のルールに一致するとき一覧で上のルールを選ぶ", () => {
    const rules = [rule("業務", [contains("github.com/wire2c7")]), rule("開発", [contains("github.com")])];
    expect(findMatchingRule("https://github.com/wire2c7/tabherd", rules)?.name).toBe("業務");
  });

  it("どのルールにも一致しないとき null を返す", () => {
    const rules = [rule("開発", [contains("github.com")])];
    expect(findMatchingRule("https://example.com/", rules)).toBeNull();
  });

  it("グループ名が空のルールは判定の対象にしない", () => {
    const rules = [rule("", [contains("github.com")])];
    expect(findMatchingRule("https://github.com/", rules)).toBeNull();
  });

  it("グループ名が上のルールと重複するルールは判定の対象にしない", () => {
    const rules = [
      rule("開発", [contains("gitlab.com")]),
      rule("資料", [contains("example.com")]),
      { ...rule("開発", [contains("github.com")]), id: "dup" },
    ];
    expect(findMatchingRule("https://github.com/", rules)).toBeNull();
  });

  it("構文が不正な正規表現があってもほかの条件の判定を続ける", () => {
    const rules = [rule("開発", [regex("("), contains("github.com")])];
    expect(findMatchingRule("https://github.com/", rules)?.name).toBe("開発");
  });
});
