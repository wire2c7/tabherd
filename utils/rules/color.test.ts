import { describe, expect, it } from "vitest";

import { pickNewRuleColor } from "./color";
import type { GroupColor, Rule } from "./types";
import { GROUP_COLORS } from "./types";

function ruleWithColor(color: GroupColor): Rule {
  return { id: color, name: color, color, conditions: [] };
}

describe("新しいルールの色", () => {
  it("ルールがなければ grey の次の色（blue）を選ぶ", () => {
    // 前提: ルールが1件も無い
    // 検証: grey の次の色 blue を返す
    expect(pickNewRuleColor([])).toBe("blue");
  });

  it("使われていない色を順に選ぶ", () => {
    // 前提: blue・yellow が既に使われている
    // 検証: 使われていない色のうち順番が最初の red を返す
    expect(pickNewRuleColor([ruleWithColor("blue"), ruleWithColor("yellow")])).toBe("red");
  });

  it("grey 以外がすべて使われていれば grey を選ぶ", () => {
    // 前提: grey を除くすべての色が使われている
    // 検証: grey を返す
    const rules = GROUP_COLORS.filter((color) => color !== "grey").map((color) => ruleWithColor(color));
    expect(pickNewRuleColor(rules)).toBe("grey");
  });

  it("すべての色が使われていれば grey を選ぶ", () => {
    // 前提: grey を含むすべての色が使われている
    // 検証: grey を返す
    expect(pickNewRuleColor(GROUP_COLORS.map((color) => ruleWithColor(color)))).toBe("grey");
  });
});
