import { describe, expect, it } from "vitest";

import { parseRuleTitles, parseRules } from "./parse";
import type { Rule } from "./types";

const DEV: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };
const DOCS: Rule = { id: "b", name: "資料", color: "green", conditions: [{ type: "regex", value: "\\.org/" }] };

describe("保存値の読み込み", () => {
  it("壊れていない一覧はそのまま返す", () => {
    expect(parseRules([DEV, DOCS])).toStrictEqual({ rules: [DEV, DOCS], damage: null });
  });

  it.each([
    ["文字列", "rules"],
    ["オブジェクト", { 0: DEV }],
    ["数値", 1],
  ])("保存値が配列でなければ（%s）、空の一覧にする", (_, value) => {
    expect(parseRules(value)).toStrictEqual({
      rules: [],
      damage: { notArray: true, droppedRules: 0, repairedRules: 0 },
    });
  });
});

describe("ルールの読み込み", () => {
  it.each([
    ["オブジェクトでない", "rule"],
    ["null", null],
    ["id が文字列でない", { ...DEV, id: 1 }],
    ["name が無い", { id: "c", color: "red", conditions: [] }],
  ])("ルールが読めなければ（%s）、そのルールだけを除く", (_, broken) => {
    expect(parseRules([broken, DOCS])).toStrictEqual({
      rules: [DOCS],
      damage: { notArray: false, droppedRules: 1, repairedRules: 0 },
    });
  });

  it("id が上のルールと同じルールは除く", () => {
    expect(parseRules([DEV, { ...DOCS, id: DEV.id }])).toStrictEqual({
      rules: [DEV],
      damage: { notArray: false, droppedRules: 1, repairedRules: 0 },
    });
  });
});

describe("ルールの項目の読み込み", () => {
  it("条件の一覧が配列でなければ、条件なしにする", () => {
    expect(parseRules([{ ...DEV, conditions: null }, DOCS])).toStrictEqual({
      rules: [{ ...DEV, conditions: [] }, DOCS],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
  });

  it("読めない条件だけを除く", () => {
    const conditions = [
      null,
      { type: "prefix", value: "https://" },
      { type: "contains", value: 1 },
      { type: "contains", value: "/dev/" },
    ];
    expect(parseRules([{ ...DEV, conditions }])).toStrictEqual({
      rules: [DEV],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
  });

  it.each([
    ["タブグループの色でない", "black"],
    ["無い", undefined],
  ])("色が%sときは grey にする", (_, color) => {
    expect(parseRules([{ ...DEV, color }])).toStrictEqual({
      rules: [{ ...DEV, color: "grey" }],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
  });

  it("型に無いプロパティは捨て、壊れていたことには数えない", () => {
    expect(
      parseRules([{ ...DEV, extra: true, conditions: [{ type: "contains", value: "/dev/", extra: 1 }] }]),
    ).toStrictEqual({ rules: [DEV], damage: null });
  });
});

describe("ルールが持っているグループのタイトルの読み込み", () => {
  it("ルールの ID からタイトルへの対応として読む", () => {
    expect(parseRuleTitles({ dev: "開発", docs: "資料" })).toStrictEqual(
      new Map([
        ["dev", "開発"],
        ["docs", "資料"],
      ]),
    );
  });

  it("値が文字列でない項目だけを除く", () => {
    expect(parseRuleTitles({ dev: "開発", docs: 1 })).toStrictEqual(new Map([["dev", "開発"]]));
  });

  it("オブジェクトでなければ、どのルールもタイトルを持っていないものとする", () => {
    expect(parseRuleTitles("broken")).toStrictEqual(new Map());
  });
});
