import { describe, expect, it } from "vitest";

import { createSampleRules } from "./seed";
import { conditionTarget } from "./types";

describe("サンプルルールの名前と条件", () => {
  it("「⚙設定」「📺️動画」「📃ブログ」の3件を、この順で作る", () => {
    // 前提: なし
    // 検証: 名前がこの順に並ぶ
    const rules = createSampleRules();
    expect(rules.map((rule) => rule.name)).toStrictEqual(["⚙設定", "📺️動画", "📃ブログ"]);
  });

  it("「⚙設定」はURLに chrome:// を含む条件を1つだけ持つ", () => {
    // 前提: なし
    // 検証: 条件が1件で、対象が url、種類が contains、値が chrome://
    const rules = createSampleRules();
    expect(rules[0]?.conditions).toStrictEqual([{ target: "url", type: "contains", value: "chrome://" }]);
  });

  it("「📺️動画」はURLに動画サイトのドメインを含む条件を4つ持つ", () => {
    // 前提: なし
    // 検証: 4件とも対象が url、種類が contains、値が指定した4つのドメイン
    const video = createSampleRules()[1];
    expect(video?.conditions.map((condition) => conditionTarget(condition))).toStrictEqual([
      "url",
      "url",
      "url",
      "url",
    ]);
    expect(video?.conditions.map((condition) => condition.value)).toStrictEqual([
      "youtube.com",
      "nicovideo.jp",
      "netflix.com",
      "twitch.tv",
    ]);
  });

  it("「📃ブログ」はタイトルの部分一致とURLの部分一致を1つずつ持つ", () => {
    // 前提: なし
    // 検証: 1件目がタイトル対象で値がブログ、2件目がURL対象で値がblog
    const blog = createSampleRules()[2];
    expect(blog?.conditions).toStrictEqual([
      { target: "title", type: "contains", value: "ブログ" },
      { target: "url", type: "contains", value: "blog" },
    ]);
  });
});

describe("サンプルルールの色とID", () => {
  it("3件の色が互いに異なり、grey を含まない", () => {
    // 前提: なし
    // 検証: 色の集合の大きさが3で、grey を含まない
    const rules = createSampleRules();
    const colors = new Set(rules.map((rule) => rule.color));
    expect(colors.size).toBe(3);
    expect(colors.has("grey")).toBe(false);
  });

  it("呼び出すたびに異なる ID を持つルールを作る", () => {
    // 前提: なし
    // 検証: 2回の呼び出しで、同じ名前のルールの ID が異なる
    const first = createSampleRules();
    const second = createSampleRules();
    for (const [index, rule] of first.entries()) {
      expect(rule.id).not.toBe(second[index]?.id);
    }
  });
});
