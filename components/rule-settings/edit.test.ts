import { describe, expect, it } from "vitest";

import type { Rule } from "../../utils/rules/types";

import { addCondition, addRule, removeCondition, removeRule, updateCondition, updateRule } from "./edit";

const dev: Rule = {
  id: "dev",
  name: "開発",
  color: "blue",
  conditions: [
    { type: "contains", value: "github.com" },
    { type: "regex", value: "gitlab" },
  ],
};
const docs: Rule = { id: "docs", name: "資料", color: "red", conditions: [] };

describe("ルールの追加", () => {
  it("一覧の末尾に、空のグループ名と空の部分一致の条件を持つルールを加える", () => {
    expect(addRule([dev], "new")).toStrictEqual([
      dev,
      { id: "new", name: "", color: "red", conditions: [{ type: "contains", value: "" }] },
    ]);
  });

  it("元の一覧を変えない", () => {
    const rules = [dev];
    addRule(rules, "new");
    expect(rules).toStrictEqual([dev]);
  });
});

describe("ルールの編集・削除", () => {
  it("id のルールだけを置き換える", () => {
    expect(updateRule([dev, docs], "docs", (rule) => ({ ...rule, name: "Docs" }))).toStrictEqual([
      dev,
      { ...docs, name: "Docs" },
    ]);
  });

  it("id のルールを一覧から除く", () => {
    expect(removeRule([dev, docs], "dev")).toStrictEqual([docs]);
  });
});

describe("条件の追加・編集・削除", () => {
  it("条件を末尾に加える", () => {
    expect(addCondition(docs).conditions).toStrictEqual([{ type: "contains", value: "" }]);
  });

  it("index 番目の条件だけを置き換える", () => {
    expect(updateCondition(dev, 1, { type: "regex", value: "^https://" }).conditions).toStrictEqual([
      { type: "contains", value: "github.com" },
      { type: "regex", value: "^https://" },
    ]);
  });

  it("index 番目の条件を除く", () => {
    expect(removeCondition(dev, 0).conditions).toStrictEqual([{ type: "regex", value: "gitlab" }]);
  });
});
