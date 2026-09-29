import { describe, expect, it } from "vitest";

import type { Rule } from "../../utils/rules/types";

import { addCondition, addRule, moveRule, removeCondition, removeRule, updateCondition, updateRule } from "./edit";

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

describe("ルールの並び替え", () => {
  const work: Rule = { id: "work", name: "業務", color: "green", conditions: [] };

  it("下のルールを上へ動かす", () => {
    expect(moveRule([dev, docs, work], 2, 0)).toStrictEqual([work, dev, docs]);
  });

  it("上のルールを下へ動かす", () => {
    expect(moveRule([dev, docs, work], 0, 2)).toStrictEqual([docs, work, dev]);
  });

  it("移動元と移動先が同じなら並びは変わらない", () => {
    expect(moveRule([dev, docs], 1, 1)).toStrictEqual([dev, docs]);
  });

  it("範囲外の位置は無視する", () => {
    expect(moveRule([dev, docs], 0, 2)).toStrictEqual([dev, docs]);
    expect(moveRule([dev, docs], -1, 0)).toStrictEqual([dev, docs]);
  });

  it("元の一覧を変えない", () => {
    const rules = [dev, docs];
    moveRule(rules, 1, 0);
    expect(rules).toStrictEqual([dev, docs]);
  });
});
