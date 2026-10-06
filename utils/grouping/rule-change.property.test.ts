import { array, assert, constantFrom, dictionary, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { validRules } from "../rules/match";
import type { Rule } from "../rules/types";
import { diffRules } from "./rule-change";

const IDS = ["r0", "r1", "r2", "r3", "r4"] as const;
// 名前を少なくして、重複・入れ替え・タイトルの引き継ぎが起きやすくする
const nameArb = constantFrom("", "a", "b", "c", "d");
const namesArb = array(nameArb, { minLength: 1, maxLength: IDS.length });
const titlesArb = dictionary(constantFrom(...IDS), constantFrom("a", "b", "c", "d"));

function rulesOf(names: readonly string[]): Rule[] {
  return names.map((name, index) => ({ id: IDS[index] ?? "", name, color: "blue", conditions: [] }));
}

describe("ルールの変更の差分の性質", () => {
  it("返す記録では、有効なルールはどれも自分の名前を持ち、もう一度求めても記録が変わらない", () => {
    assert(
      property(namesArb, namesArb, titlesArb, (oldNames, newNames, titles) => {
        const newRules = rulesOf(newNames);
        const change = diffRules(rulesOf(oldNames), newRules, new Map(Object.entries(titles)));
        for (const rule of validRules(newRules, change.titles)) {
          expect(change.titles.get(rule.id)).toBe(rule.name);
        }
        expect(diffRules(newRules, newRules, change.titles).titles).toStrictEqual(change.titles);
      }),
    );
  });
});
