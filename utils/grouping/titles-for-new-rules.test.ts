import { describe, expect, it } from "vitest";

import type { Rule } from "../rules/types";
import { titlesForNewRules } from "./rule-change";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github.com" }] };
const DOCS: Rule = {
  id: "docs",
  name: "資料",
  color: "green",
  conditions: [{ type: "contains", value: "example.com" }],
};

/** id のルールが name のタイトルを持っている RuleTitles */
function titlesOf(...entries: [Rule, string][]): Map<string, string> {
  return new Map(entries.map(([rule, title]) => [rule.id, title]));
}

describe("タブイベントの判定し直しで足すタイトル（Issue #36・#110）", () => {
  it("記録に無いルールのタイトルを足す", () => {
    // 前提: DEV のタイトルがまだ記録に無い（タブイベントがルールの新規作成より先に判定した場合に相当）
    // 検証: DEV のタイトルとして、今の名前「開発」が足される
    expect(titlesForNewRules([DEV], new Map())).toStrictEqual(titlesOf([DEV, "開発"]));
  });

  it("記録済みのルールのタイトルは、今の名前と違っていても上書きしない", () => {
    // 前提: DEV は記録上まだ「開発」のままだが、ルールの名前はすでに「Dev」に変わっている
    //       （ルール変更の反映がまだ終わっていない間に、タブイベントが判定し直した場合に相当）
    // 検証: 記録は「開発」のまま変わらない。ここで「Dev」に進めてしまうと、まだ実行していないルール変更の
    //       反映が「変更済み」と誤認し、実際のグループの改名が永久にスキップされてしまう（Issue #110）
    expect(titlesForNewRules([{ ...DEV, name: "Dev" }], titlesOf([DEV, "開発"]))).toStrictEqual(
      titlesOf([DEV, "開発"]),
    );
  });

  it("記録済みのルールと記録に無いルールが混ざっていても、記録済みの分だけ変えない", () => {
    expect(titlesForNewRules([{ ...DEV, name: "Dev" }, DOCS], titlesOf([DEV, "開発"]))).toStrictEqual(
      titlesOf([DEV, "開発"], [DOCS, "資料"]),
    );
  });
});
