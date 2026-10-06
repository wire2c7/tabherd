import { describe, expect, it } from "vitest";

import type { Rule } from "../rules/types";
import { TAB_GROUP_ID_NONE, planGrouping } from "./plan";
import { diffRules, planGroupUpdates } from "./rule-change";
import type { WindowSnapshot } from "./types";

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

describe("ルールの変更の差分", () => {
  it("名前が変わったルールは、旧い名前から新しい名前への変更になる", () => {
    // 前提: DEV ルールの名前だけを「開発」から「Dev」に変える
    // 検証: 旧い名前「開発」から新しい名前「Dev」への update が1件出て、retiredNames に旧い名前が入り、titles が新しい名前に更新される
    expect(diffRules([DEV, DOCS], [{ ...DEV, name: "Dev" }, DOCS])).toStrictEqual({
      updates: [{ oldName: "開発", name: "Dev", color: "blue" }],
      retiredNames: ["開発"],
      titles: titlesOf([DEV, "Dev"], [DOCS, "資料"]),
    });
  });

  it("色が変わったルールは、同じ名前のまま色の変更になる", () => {
    // 前提: DEV ルールの色だけを blue から red に変える
    // 検証: 名前「開発」のまま色だけを red にする update が1件出て、retiredNames は空のまま
    expect(diffRules([DEV], [{ ...DEV, color: "red" }])).toStrictEqual({
      updates: [{ oldName: "開発", name: "開発", color: "red" }],
      retiredNames: [],
      titles: titlesOf([DEV, "開発"]),
    });
  });
});

describe("ルールの削除・追加の差分", () => {
  it("削除されたルールの名前は、旧い名前として返す", () => {
    // 前提/検証: DEV を削除し DOCS だけが残ると、update は無く retiredNames に DEV の旧い名前「開発」が入る
    expect(diffRules([DEV, DOCS], [DOCS])).toStrictEqual({
      updates: [],
      retiredNames: ["開発"],
      titles: titlesOf([DOCS, "資料"]),
    });
  });

  it("変わっていないルール・追加されたルールは差分にならない", () => {
    // 前提/検証: DEV はそのままで DOCS を追加すると、update も retiredNames も空で titles に両方が入る
    expect(diffRules([DEV], [DEV, DOCS])).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles: titlesOf([DEV, "開発"], [DOCS, "資料"]),
    });
  });

  it("変更前に無効でタイトルも持っていなかったルールは比べない", () => {
    // 前提: 変更前の DEV は名前が空（無効）で、記録 (titles) も渡さない。変更後に DEV が名前「開発」を持つ
    // 検証: 比較対象が無いため update は出ず、retiredNames も空。titles には新しい名前が入る
    expect(diffRules([{ ...DEV, name: "" }], [DEV])).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles: titlesOf([DEV, "開発"]),
    });
  });

  it("名前を入れ替えたルールは、どちらの名前も旧い名前にならない", () => {
    // 前提: DEV と DOCS の名前を互いに入れ替える（開発⇄資料）
    // 検証: 両方のルールに update が出るが、retiredNames は空（名前が別のルールに引き継がれ、どちらも使われなくなったわけではない）
    expect(
      diffRules(
        [DEV, DOCS],
        [
          { ...DEV, name: "資料" },
          { ...DOCS, name: "開発" },
        ],
      ),
    ).toStrictEqual({
      updates: [
        { oldName: "開発", name: "資料", color: "blue" },
        { oldName: "資料", name: "開発", color: "green" },
      ],
      retiredNames: [],
      titles: titlesOf([DEV, "資料"], [DOCS, "開発"]),
    });
  });
});

describe("無効になったルールのタイトル", () => {
  it("名前を空にしたルールは、空にする前のタイトルを持ち続け、旧い名前にならない", () => {
    // 前提: DEV ルールの名前を「開発」から空に変える（無効化）
    // 検証: update も retiredNames も空のまま、titles には空にする前のタイトル「開発」が残る
    expect(diffRules([DEV], [{ ...DEV, name: "" }])).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles: titlesOf([DEV, "開発"]),
    });
  });

  it("持ち続けたタイトルは、名前を入れると新しい名前への変更になる", () => {
    // 前提: DEV は名前が空（記録上のタイトルは「開発」）のまま、変更後に名前を「Dev」に入れる
    // 検証: 持ち続けたタイトル「開発」から新しい名前「Dev」への update が出て、retiredNames に「開発」が入る
    expect(diffRules([{ ...DEV, name: "" }], [{ ...DEV, name: "Dev" }], titlesOf([DEV, "開発"]))).toStrictEqual({
      updates: [{ oldName: "開発", name: "Dev", color: "blue" }],
      retiredNames: ["開発"],
      titles: titlesOf([DEV, "Dev"]),
    });
  });

  it("起動し直したとき（変更前後が同じ）も、記録したタイトルを持ち続ける", () => {
    // 前提: 名前が空の同じルールを変更前後に渡す（起動し直しを再現）。記録上のタイトルは「開発」
    // 検証: update も retiredNames も空のまま、titles は変わらず「開発」を持ち続ける
    const emptied: Rule = { ...DEV, name: "" };
    expect(diffRules([emptied], [emptied], titlesOf([DEV, "開発"]))).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles: titlesOf([DEV, "開発"]),
    });
  });

  it("同じ名前に戻したときも、色を合わせる変更を出す（無効なあいだに色を変えていても揃う）", () => {
    // 前提: DEV は名前が空（記録上のタイトルは「開発」）から、変更後に元の名前「開発」・色 blue に戻す
    // 検証: 同じ名前「開発」のまま、色を揃える update（oldName/name とも「開発」）が1件出る
    expect(diffRules([{ ...DEV, name: "" }], [DEV], titlesOf([DEV, "開発"])).updates).toStrictEqual([
      { oldName: "開発", name: "開発", color: "blue" },
    ]);
  });
});

describe("無効なルールの削除・名前の重複", () => {
  it("無効なまま削除すると、持ち続けたタイトルを旧い名前として返す", () => {
    // 前提: DEV は名前が空（記録上のタイトルは「開発」）のまま削除し、DOCS だけが残る
    // 検証: update は無く、retiredNames に持ち続けていたタイトル「開発」が入り、titles には DOCS の分だけが残る
    expect(diffRules([{ ...DEV, name: "" }, DOCS], [DOCS], titlesOf([DEV, "開発"], [DOCS, "資料"]))).toStrictEqual({
      updates: [],
      retiredNames: ["開発"],
      titles: titlesOf([DOCS, "資料"]),
    });
  });

  it("後から同じ名前にしたルールは無効になり、元のタイトルを持ち続ける", () => {
    // 前提: DOCS がすでに「資料」のタイトルを持つ状態で、DEV の名前を後から「資料」に変える（先に持っていたのは DOCS）
    // 検証: DEV は無効になるため update は出ず、titles は変更前のまま（DEV は自分のタイトルを得られない）
    const titles = titlesOf([DEV, "開発"], [DOCS, "資料"]);
    expect(diffRules([DEV, DOCS], [{ ...DEV, name: "資料" }, DOCS], titles)).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles,
    });
  });

  it("名前を空にしたルールが持ち続けるタイトルを、ほかのルールの名前にしても、そのルールは無効になる", () => {
    // 前提: DEV は名前を空にして「開発」のタイトルを持ち続けたまま、DOCS の名前を後から「開発」に変える
    // 検証: DOCS は DEV が持つタイトルと重なるため無効になり、update も titles の変化も起きない
    const titles = titlesOf([DEV, "開発"], [DOCS, "資料"]);
    expect(
      diffRules(
        [DEV, DOCS],
        [
          { ...DEV, name: "" },
          { ...DOCS, name: "開発" },
        ],
        titles,
      ),
    ).toStrictEqual({
      updates: [],
      retiredNames: [],
      titles,
    });
  });
});

const window: WindowSnapshot = {
  id: 1,
  tabs: [
    { id: 10, url: "https://github.com/", pinned: false, groupId: 100 },
    { id: 11, url: "https://example.com/", pinned: false, groupId: 200 },
    { id: 12, url: "https://example.org/", pinned: false, groupId: TAB_GROUP_ID_NONE },
  ],
  groups: [
    { id: 100, title: "開発", color: "blue" },
    { id: 200, title: "資料", color: "green" },
  ],
};

describe("ルールの名前・色の変更の反映", () => {
  it("グループ名を変えると、既存のグループのタイトルが変わり、タブは動かない", () => {
    // 前提: DEV の名前を「開発」から「Dev」に変え、既存のグループ(100)はまだ旧いタイトル「開発」を持つ
    // 検証: グループ(100)のタイトルを「Dev」に変える update-group が1件出て、タイトルを変えた後のスナップショットでは再計画しても操作が出ない
    const newRules = [{ ...DEV, name: "Dev" }, DOCS];
    const { updates } = diffRules([DEV, DOCS], newRules);
    expect(planGroupUpdates(window, updates)).toStrictEqual([
      { type: "update-group", groupId: 100, title: "Dev", color: "blue" },
    ]);
    // タイトルを変えた後のスナップショットでは、タブはすでに新しい名前のグループに入っている
    const renamed: WindowSnapshot = {
      ...window,
      groups: [
        { id: 100, title: "Dev", color: "blue" },
        { id: 200, title: "資料", color: "green" },
      ],
    };
    expect(planGrouping(renamed, newRules)).toStrictEqual([]);
  });

  it("色を変えると、既存のグループの色が変わる", () => {
    // 前提: DEV の色だけを blue から red に変える（名前は変えない）
    // 検証: グループ(100)の色を red に変える update-group が1件出る
    const { updates } = diffRules([DEV, DOCS], [{ ...DEV, color: "red" }, DOCS]);
    expect(planGroupUpdates(window, updates)).toStrictEqual([
      { type: "update-group", groupId: 100, title: "開発", color: "red" },
    ]);
  });

  it("すでに新しいタイトル・色のグループには操作を出さない", () => {
    // 前提: update の内容（名前「開発」・色 blue）が、既存グループ(100)の現在のタイトル・色とすでに一致する
    // 検証: 操作が出ない（空配列）
    expect(planGroupUpdates(window, [{ oldName: "開発", name: "開発", color: "blue" }])).toStrictEqual([]);
  });
});

describe("ルールの削除の反映", () => {
  it("ルールを削除すると、そのグループのタブはほかのルールに一致しなければ外れる", () => {
    // 前提: DEV ルールを削除し DOCS だけにする。DEV のグループ(100)のタブはどのルールにも一致しない
    // 検証: グループの更新操作は出ず（planGroupUpdates が空）、retiredNames を渡した planGrouping ではそのタブを ungroup する
    const newRules = [DOCS];
    const { updates, retiredNames } = diffRules([DEV, DOCS], newRules);
    expect(planGroupUpdates(window, updates)).toStrictEqual([]);
    expect(planGrouping(window, newRules, { retiredNames })).toStrictEqual([{ type: "ungroup", tabIds: [10] }]);
  });

  it("ルールを削除すると、そのグループのタブはほかのルールに一致すればそちらへ移る", () => {
    // 前提: DEV ルールを削除し、新しく github に一致する「コード」ルールを追加する。DEV のグループ(100)のタブは「コード」に一致する
    // 検証: retiredNames を渡した planGrouping が、そのタブを新しい「コード」グループへ作って入れる1操作を出す
    const newRules = [
      DOCS,
      { id: "code", name: "コード", color: "red", conditions: [{ type: "contains", value: "github" }] },
    ] satisfies Rule[];
    const { retiredNames } = diffRules([DEV, DOCS], newRules);
    expect(planGrouping(window, newRules, { retiredNames })).toStrictEqual([
      { type: "create-group", windowId: 1, title: "コード", color: "red", tabIds: [10] },
    ]);
  });

  it("旧い名前を渡さなければ、削除されたルールのグループは手動のグループとして扱う", () => {
    // 前提: DEV ルールを削除した newRules=[DOCS] だけを渡し、retiredNames（旧い名前）を渡さない
    // 検証: 操作が出ない（DEV のグループは手動のグループと区別が付かず、管理対象外として扱われる）
    expect(planGrouping(window, [DOCS])).toStrictEqual([]);
  });
});

describe("名前の入れ替え・タイトルの引き継ぎ", () => {
  it("記録があっても、名前を入れ替えたルールはどちらも有効になり、グループのタイトルを入れ替える", () => {
    // 前提: 記録 (titles) では DEV が「開発」・DOCS が「資料」を持つが、変更前の DEV はすでに名前「資料」になっており（DOCS と重複）、
    //       変更後は DEV が「資料」のまま、DOCS が「開発」になる（記録上のタイトルを互いに入れ替える形）
    // 検証: 両方のルールに update（旧名→新名、色も自分の色）が出て、retiredNames は空、titles も入れ替わる
    const titles = titlesOf([DEV, "開発"], [DOCS, "資料"]);
    const swapped = [
      { ...DEV, name: "資料" },
      { ...DOCS, name: "開発" },
    ];
    expect(diffRules([{ ...DEV, name: "資料" }, DOCS], swapped, titles)).toStrictEqual({
      updates: [
        { oldName: "開発", name: "資料", color: "blue" },
        { oldName: "資料", name: "開発", color: "green" },
      ],
      retiredNames: [],
      titles: titlesOf([DEV, "資料"], [DOCS, "開発"]),
    });
  });

  it("持ち主がタイトルを手放したら、同じ反映で、同じ名前の別のルールがそのタイトルを持つ", () => {
    // 前提: DEV が記録上「開発」を持つ中、同じ名前「開発」の別ルール(other)も最初から存在し、DEV の名前を「Dev」に変える（タイトルを手放す）
    // 検証: 持ち主が変わり、DEV は新しい名前「Dev」の記録に、other が「開発」のタイトルを引き継いで持つ
    const other: Rule = { ...DOCS, id: "other", name: "開発" };
    expect(diffRules([DEV, other], [{ ...DEV, name: "Dev" }, other], titlesOf([DEV, "開発"])).titles).toStrictEqual(
      titlesOf([DEV, "Dev"], [other, "開発"]),
    );
  });

  it("持ち主が削除したタイトルを引き継いだルールは、グループの色を自分の色に変える", () => {
    // 前提: DEV は名前を空にして「開発」のタイトルを削除し、同じ名前「開発」を持つ別ルール(other, 色 green)が残る
    // 検証: other が「開発」のタイトルを引き継ぎ、グループの色を自分の色(green)に変える update が出て、retiredNames は空
    const emptied: Rule = { ...DEV, name: "" };
    const other: Rule = { ...DOCS, id: "other", name: "開発" };
    expect(diffRules([emptied, other], [other], titlesOf([DEV, "開発"]))).toStrictEqual({
      updates: [{ oldName: "開発", name: "開発", color: "green" }],
      retiredNames: [],
      titles: titlesOf([other, "開発"]),
    });
  });
});
