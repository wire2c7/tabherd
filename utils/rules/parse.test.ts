import { describe, expect, it } from "vitest";

import { parseRuleTitles, parseRules } from "./parse";
import type { Rule } from "./types";

const DEV: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };
const DOCS: Rule = { id: "b", name: "資料", color: "green", conditions: [{ type: "regex", value: "\\.org/" }] };

describe("保存値の読み込み", () => {
  it("壊れていない一覧はそのまま返す", () => {
    // 前提: 2件とも型どおりの正しいルール
    // 検証: 元のまま返り、damage が null になる
    expect(parseRules([DEV, DOCS])).toStrictEqual({ rules: [DEV, DOCS], damage: null });
  });

  it.each([
    ["文字列", "rules"],
    ["オブジェクト", { 0: DEV }],
    ["数値", 1],
  ])("保存値が配列でなければ（%s）、空の一覧にする", (_, value) => {
    // 前提: 保存値が配列でない（文字列・オブジェクト・数値のいずれか）
    // 検証: rules が空になり、damage.notArray が true、droppedRules・repairedRules は0になる
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
    // 前提: 1番目のルールが読めない形（オブジェクトでない・null・id が文字列でない・name が無い）、2番目は正しいルール
    // 検証: 読めない1件だけが除かれ、damage.droppedRules が1になる
    expect(parseRules([broken, DOCS])).toStrictEqual({
      rules: [DOCS],
      damage: { notArray: false, droppedRules: 1, repairedRules: 0 },
    });
  });

  it("id が上のルールと同じルールは除く", () => {
    // 前提: 2番目のルールの id が1番目と同じ
    // 検証: 2番目だけが除かれ、damage.droppedRules が1になる
    expect(parseRules([DEV, { ...DOCS, id: DEV.id }])).toStrictEqual({
      rules: [DEV],
      damage: { notArray: false, droppedRules: 1, repairedRules: 0 },
    });
  });
});

describe("ルールの項目の読み込み", () => {
  it("条件の一覧が配列でなければ、条件なしにする", () => {
    // 前提: 1番目のルールの conditions が null
    // 検証: conditions が空配列に直り、damage.repairedRules が1になる（ルールは除かれない）
    expect(parseRules([{ ...DEV, conditions: null }, DOCS])).toStrictEqual({
      rules: [{ ...DEV, conditions: [] }, DOCS],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
  });

  it("読めない条件だけを除く", () => {
    // 前提: conditions に null・不正な type・value が文字列でない条件・正しい条件が混在する
    // 検証: 読めない3件が除かれ、正しい1件だけが残り、damage.repairedRules が1になる
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
    // 前提: color がタブグループの色一覧に無い値、または無い（undefined）
    // 検証: color が grey に直り、damage.repairedRules が1になる
    expect(parseRules([{ ...DEV, color }])).toStrictEqual({
      rules: [{ ...DEV, color: "grey" }],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
  });

  it("型に無いプロパティは捨て、壊れていたことには数えない", () => {
    // 前提: ルール・条件のどちらにも型に無い余分なプロパティ（extra）がある
    // 検証: 余分なプロパティが捨てられて型どおりの値になり、damage は null のまま（壊れた扱いにしない）
    expect(
      parseRules([{ ...DEV, extra: true, conditions: [{ type: "contains", value: "/dev/", extra: 1 }] }]),
    ).toStrictEqual({ rules: [DEV], damage: null });
  });
});

describe("ルールが持っているグループのタイトルの読み込み", () => {
  it("ルールの ID からタイトルへの対応として読む", () => {
    // 前提: キーがルール ID、値が文字列のオブジェクト
    // 検証: 同じ対応を持つ Map を返す
    expect(parseRuleTitles({ dev: "開発", docs: "資料" })).toStrictEqual(
      new Map([
        ["dev", "開発"],
        ["docs", "資料"],
      ]),
    );
  });

  it("値が文字列でない項目だけを除く", () => {
    // 前提: docs の値が文字列ではなく数値
    // 検証: docs だけが除かれ、dev の対応だけが残る
    expect(parseRuleTitles({ dev: "開発", docs: 1 })).toStrictEqual(new Map([["dev", "開発"]]));
  });

  it("オブジェクトでなければ、どのルールもタイトルを持っていないものとする", () => {
    // 前提: 値がオブジェクトではなく文字列
    // 検証: 空の Map を返す
    expect(parseRuleTitles("broken")).toStrictEqual(new Map());
  });
});
