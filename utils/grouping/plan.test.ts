import { describe, expect, it } from "vitest";

import type { Rule } from "../rules/types";
import { TAB_GROUP_ID_NONE, planGrouping } from "./plan";
import type { GroupSnapshot, TabSnapshot, WindowSnapshot } from "./types";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github.com" }] };
const DOCS: Rule = {
  id: "docs",
  name: "資料",
  color: "green",
  conditions: [{ type: "contains", value: "example.com" }],
};
const RULES = [DEV, DOCS];

function tab(id: number, url: string, groupId = TAB_GROUP_ID_NONE): TabSnapshot {
  return { id, url, pinned: false, groupId };
}

function group(id: number, title: string): GroupSnapshot {
  return { id, title, color: "grey" };
}

function windowOf(tabs: TabSnapshot[], groups: GroupSnapshot[] = [], id = 1): WindowSnapshot {
  return { id, tabs, groups };
}

describe("タブの判定とグループ化", () => {
  it("一致したルールのグループがなければ、ルールの名前・色で作って入れる", () => {
    const window = windowOf([tab(10, "https://github.com/")]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10] },
    ]);
  });

  it("同じウィンドウに一致したルールのグループがあれば、そこへ入れる", () => {
    const window = windowOf(
      [tab(10, "https://github.com/a", 100), tab(11, "https://github.com/b")],
      [group(100, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 100, tabIds: [11] }]);
  });

  it("すでにそのグループに入っているタブには操作を出さない", () => {
    const window = windowOf([tab(10, "https://github.com/", 100)], [group(100, "開発")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });

  it("同じルールに一致する複数のタブは、1つのグループを作ってまとめる", () => {
    const window = windowOf([
      tab(10, "https://github.com/a"),
      tab(11, "https://example.com/"),
      tab(12, "https://github.com/b"),
    ]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10, 12] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("判定するタブを指定すると、そのタブだけに操作を出す", () => {
    const window = windowOf([tab(10, "https://github.com/a"), tab(11, "https://github.com/b")]);
    expect(planGrouping(window, RULES, { targetTabIds: new Set([11]) })).toStrictEqual([
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [11] },
    ]);
  });

  it("どのルールにも一致せず、グループにも入っていないタブには操作を出さない", () => {
    const window = windowOf([tab(10, "https://example.org/")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("管理対象のグループ", () => {
  it("ルールのグループ名と異なるタイトルのグループのタブは移動しない", () => {
    const window = windowOf([tab(10, "https://github.com/", 100)], [group(100, "手動")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });

  it("タイトルが空のグループは管理対象にしない（グループ名が空のルールは無効）", () => {
    const rules: Rule[] = [{ ...DEV, name: "" }];
    const window = windowOf([tab(10, "https://example.org/", 100)], [group(100, "")]);
    expect(planGrouping(window, rules)).toStrictEqual([]);
  });

  it("別のウィンドウのグループは使わず、ウィンドウごとにグループを作る", () => {
    // ウィンドウ A（id: 1）の「開発」のグループは、ウィンドウ B（id: 2）のスナップショットに含まれない
    const windowB = windowOf([tab(20, "https://github.com/")], [], 2);
    expect(planGrouping(windowB, RULES)).toStrictEqual([
      { type: "create-group", windowId: 2, title: "開発", color: "blue", tabIds: [20] },
    ]);
  });

  it("同名のグループが複数あるときは、タブバーで左にあるものへ入れる", () => {
    const window = windowOf(
      [tab(10, "https://github.com/a", 200), tab(11, "https://github.com/b", 100), tab(12, "https://github.com/c")],
      [group(100, "開発"), group(200, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 200, tabIds: [12] }]);
  });
});

describe("一致しなくなったタブ", () => {
  it("別のルールに一致する URL へ移動したタブは、そのルールのグループへ移す", () => {
    const window = windowOf(
      [tab(10, "https://example.com/", 100), tab(11, "https://example.com/docs", 200)],
      [group(100, "開発"), group(200, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "add-to-group", groupId: 200, tabIds: [10] }]);
  });

  it("別のルールのグループがなければ作って移す", () => {
    const window = windowOf([tab(10, "https://example.com/", 100)], [group(100, "開発")]);
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [10] },
    ]);
  });

  it("どのルールにも一致しない URL へ移動したタブは、グループから外す", () => {
    const window = windowOf(
      [tab(10, "https://example.org/", 100), tab(11, "https://example.org/b", 100)],
      [group(100, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([{ type: "ungroup", tabIds: [10, 11] }]);
  });

  it("手動で作ったグループのタブは、どのルールにも一致しなくても外さない", () => {
    const window = windowOf([tab(10, "https://example.org/", 100)], [group(100, "手動")]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("対象外のタブ", () => {
  it("ピン留めされたタブはグループに入れない", () => {
    const window = windowOf([{ ...tab(10, "https://github.com/"), pinned: true }]);
    expect(planGrouping(window, RULES)).toStrictEqual([]);
  });
});

describe("同じ判定で空になるグループ", () => {
  it("元のタブがすべて外れるグループには入れず、新しく作って入れる", () => {
    const window = windowOf(
      [tab(10, "https://other.test/", 100), tab(11, "https://example.com/")],
      [group(100, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "ungroup", tabIds: [10] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("元のタブがすべて別のグループへ移るグループには入れず、新しく作って入れる", () => {
    const window = windowOf(
      [tab(10, "https://github.com/a", 100), tab(11, "https://example.com/"), tab(12, "https://github.com/b", 101)],
      [group(100, "資料"), group(101, "開発")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "add-to-group", groupId: 101, tabIds: [10] },
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });

  it("2つのグループの中身が入れ替わるときは、どちらにも入れず、それぞれ新しく作って入れる", () => {
    const window = windowOf(
      [tab(10, "https://example.com/", 100), tab(11, "https://github.com/", 101)],
      [group(100, "開発"), group(101, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [10] },
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [11] },
    ]);
  });

  it("同名のグループのうち左のものが空になるときは、残る右のものへ入れる", () => {
    const window = windowOf(
      [tab(10, "https://other.test/", 100), tab(11, "https://example.com/a", 101), tab(12, "https://example.com/b")],
      [group(100, "資料"), group(101, "資料")],
    );
    expect(planGrouping(window, RULES)).toStrictEqual([
      { type: "ungroup", tabIds: [10] },
      { type: "add-to-group", groupId: 101, tabIds: [12] },
    ]);
  });
});

describe("無効なルールが持ち続けるタイトルのグループ", () => {
  it("中のタブは動かさず、条件に一致する新しいタブも入れない", () => {
    const emptied: Rule = { ...DEV, name: "" };
    const window = windowOf(
      [tab(10, "https://example.org/", 100), tab(11, "https://github.com/new")],
      [group(100, "開発")],
    );
    expect(planGrouping(window, [emptied, DOCS], { titles: new Map([[DEV.id, "開発"]]) })).toStrictEqual([]);
  });

  it("後から同じ名前にしたルールではなく、タイトルを持っているルールでまとめる", () => {
    const renamed: Rule = { ...DEV, name: "資料" };
    const titles = new Map([
      [DEV.id, "開発"],
      [DOCS.id, "資料"],
    ]);
    const window = windowOf([tab(10, "https://github.com/"), tab(11, "https://example.com/")]);
    expect(planGrouping(window, [renamed, DOCS], { titles })).toStrictEqual([
      { type: "create-group", windowId: 1, title: "資料", color: "green", tabIds: [11] },
    ]);
  });
});
