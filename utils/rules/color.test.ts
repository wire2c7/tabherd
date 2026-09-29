import { describe, expect, it } from "vitest";

import { pickNewRuleColor } from "./color";
import type { GroupColor, Rule } from "./types";
import { GROUP_COLORS } from "./types";

function ruleWithColor(color: GroupColor): Rule {
  return { id: color, name: color, color, conditions: [] };
}

describe("新しいルールの色", () => {
  it("ルールがなければ grey の次の色（blue）を選ぶ", () => {
    expect(pickNewRuleColor([])).toBe("blue");
  });

  it("使われていない色を順に選ぶ", () => {
    expect(pickNewRuleColor([ruleWithColor("blue"), ruleWithColor("yellow")])).toBe("red");
  });

  it("grey 以外がすべて使われていれば grey を選ぶ", () => {
    const rules = GROUP_COLORS.filter((color) => color !== "grey").map((color) => ruleWithColor(color));
    expect(pickNewRuleColor(rules)).toBe("grey");
  });

  it("すべての色が使われていれば grey を選ぶ", () => {
    expect(pickNewRuleColor(GROUP_COLORS.map((color) => ruleWithColor(color)))).toBe("grey");
  });
});
