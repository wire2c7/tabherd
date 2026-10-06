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
    // 前提: 既存のルール一覧 [dev] に id "new" のルールを加える
    // 検証: 末尾に name: ""、conditions: [{ type: "contains", value: "" }] のルールが加わる
    expect(addRule([dev], "new")).toStrictEqual([
      dev,
      { id: "new", name: "", color: "red", conditions: [{ type: "contains", value: "" }] },
    ]);
  });

  it("元の一覧を変えない", () => {
    // 前提: 一覧 [dev] に addRule を呼ぶ
    // 検証: 呼び出し後も元の変数 rules が [dev] のまま（破壊的変更していない）
    const rules = [dev];
    addRule(rules, "new");
    expect(rules).toStrictEqual([dev]);
  });
});

describe("ルールの編集・削除", () => {
  it("id のルールだけを置き換える", () => {
    // 前提: [dev, docs] のうち id "docs" のルールの name を "Docs" に変える更新関数を渡す
    // 検証: docs だけが更新され、dev はそのまま
    expect(updateRule([dev, docs], "docs", (rule) => ({ ...rule, name: "Docs" }))).toStrictEqual([
      dev,
      { ...docs, name: "Docs" },
    ]);
  });

  it("id のルールを一覧から除く", () => {
    // 前提: [dev, docs] から id "dev" を除く
    // 検証: 一覧が [docs] になる
    expect(removeRule([dev, docs], "dev")).toStrictEqual([docs]);
  });
});

describe("条件の追加・編集・削除", () => {
  it("条件を末尾に加える", () => {
    // 前提: 条件が空のルール docs に条件を加える
    // 検証: conditions が [{ type: "contains", value: "" }] になる
    expect(addCondition(docs).conditions).toStrictEqual([{ type: "contains", value: "" }]);
  });

  it("index 番目の条件だけを置き換える", () => {
    // 前提: dev の conditions（2件）の index 1 を { type: "regex", value: "^https://" } に置き換える
    // 検証: index 0 はそのまま、index 1 だけが置き換わる
    expect(updateCondition(dev, 1, { type: "regex", value: "^https://" }).conditions).toStrictEqual([
      { type: "contains", value: "github.com" },
      { type: "regex", value: "^https://" },
    ]);
  });

  it("index 番目の条件を除く", () => {
    // 前提: dev の conditions（2件）から index 0 を除く
    // 検証: 残り（index 1 だった条件）だけの配列になる
    expect(removeCondition(dev, 0).conditions).toStrictEqual([{ type: "regex", value: "gitlab" }]);
  });
});

describe("ルールの並び替え", () => {
  const work: Rule = { id: "work", name: "業務", color: "green", conditions: [] };

  it("下のルールを上へ動かす", () => {
    // 前提: [dev, docs, work] の index 2（work）を index 0 へ動かす
    // 検証: 一覧が [work, dev, docs] になる
    expect(moveRule([dev, docs, work], 2, 0)).toStrictEqual([work, dev, docs]);
  });

  it("上のルールを下へ動かす", () => {
    // 前提: [dev, docs, work] の index 0（dev）を index 2 へ動かす
    // 検証: 一覧が [docs, work, dev] になる
    expect(moveRule([dev, docs, work], 0, 2)).toStrictEqual([docs, work, dev]);
  });

  it("移動元と移動先が同じなら並びは変わらない", () => {
    // 前提: 移動元・移動先が共に index 1
    // 検証: 一覧 [dev, docs] は変わらない
    expect(moveRule([dev, docs], 1, 1)).toStrictEqual([dev, docs]);
  });

  it("範囲外の位置は無視する", () => {
    // 前提: 一覧 [dev, docs]（長さ2）に対し、範囲外の index（2、-1）を指定する
    // 検証: どちらも一覧は変わらない
    expect(moveRule([dev, docs], 0, 2)).toStrictEqual([dev, docs]);
    expect(moveRule([dev, docs], -1, 0)).toStrictEqual([dev, docs]);
  });

  it("元の一覧を変えない", () => {
    // 前提: 一覧 [dev, docs] に moveRule を呼ぶ
    // 検証: 呼び出し後も元の変数 rules が [dev, docs] のまま（破壊的変更していない）
    const rules = [dev, docs];
    moveRule(rules, 1, 0);
    expect(rules).toStrictEqual([dev, docs]);
  });
});
