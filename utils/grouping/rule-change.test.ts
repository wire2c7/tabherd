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

describe("ルールの変更の差分", () => {
  it("名前が変わったルールは、旧い名前から新しい名前への変更になる", () => {
    expect(diffRules([DEV, DOCS], [{ ...DEV, name: "Dev" }, DOCS])).toStrictEqual({
      updates: [{ oldName: "開発", name: "Dev", color: "blue" }],
      retiredNames: ["開発"],
    });
  });

  it("色が変わったルールは、同じ名前のまま色の変更になる", () => {
    expect(diffRules([DEV], [{ ...DEV, color: "red" }])).toStrictEqual({
      updates: [{ oldName: "開発", name: "開発", color: "red" }],
      retiredNames: [],
    });
  });

  it("削除されたルールの名前は、旧い名前として返す", () => {
    expect(diffRules([DEV, DOCS], [DOCS])).toStrictEqual({ updates: [], retiredNames: ["開発"] });
  });

  it("変わっていないルール・追加されたルールは差分にならない", () => {
    expect(diffRules([DEV], [DEV, DOCS])).toStrictEqual({ updates: [], retiredNames: [] });
  });

  it("名前が空になったルールは無効になるため、旧い名前として返す", () => {
    expect(diffRules([DEV], [{ ...DEV, name: "" }])).toStrictEqual({ updates: [], retiredNames: ["開発"] });
  });

  it("変更前に無効だったルールは比べない", () => {
    expect(diffRules([{ ...DEV, name: "" }], [DEV])).toStrictEqual({ updates: [], retiredNames: [] });
  });

  it("名前を入れ替えたルールは、どちらの名前も旧い名前にならない", () => {
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
    const { updates } = diffRules([DEV, DOCS], [{ ...DEV, color: "red" }, DOCS]);
    expect(planGroupUpdates(window, updates)).toStrictEqual([
      { type: "update-group", groupId: 100, title: "開発", color: "red" },
    ]);
  });

  it("すでに新しいタイトル・色のグループには操作を出さない", () => {
    expect(planGroupUpdates(window, [{ oldName: "開発", name: "開発", color: "blue" }])).toStrictEqual([]);
  });
});

describe("ルールの削除の反映", () => {
  it("ルールを削除すると、そのグループのタブはほかのルールに一致しなければ外れる", () => {
    const newRules = [DOCS];
    const { updates, retiredNames } = diffRules([DEV, DOCS], newRules);
    expect(planGroupUpdates(window, updates)).toStrictEqual([]);
    expect(planGrouping(window, newRules, { retiredNames })).toStrictEqual([{ type: "ungroup", tabIds: [10] }]);
  });

  it("ルールを削除すると、そのグループのタブはほかのルールに一致すればそちらへ移る", () => {
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
    expect(planGrouping(window, [DOCS])).toStrictEqual([]);
  });
});
