import { describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { Rule } from "../rules/types";
import { applyRuleChange, regroupAllWindows, regroupTabs } from "./regroup";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github.com" }] };
const WORK: Rule = { id: "work", name: "業務", color: "red", conditions: [{ type: "contains", value: "example.com" }] };

function browserTab(index: number, url: string, groupId: number): Browser.tabs.Tab {
  return {
    id: index + 10,
    index,
    url,
    groupId,
    windowId: 1,
    pinned: false,
    highlighted: false,
    active: false,
    frozen: false,
    incognito: false,
    // 非推奨だが Tab の型では必須のプロパティ
    // oxlint-disable-next-line typescript/no-deprecated
    selected: false,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: 0,
  };
}

function browserGroup(id: number, title: string): Browser.tabGroups.TabGroup {
  return { id, title, color: "grey", collapsed: false, shared: false, windowId: 1 };
}

// 「開発」「業務」の順にグループが並んだウィンドウを、tabs.query・tabGroups.query が返すようにする
function mockWindow() {
  const tabsQuery = vi
    .fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>()
    .mockResolvedValue([browserTab(0, "https://github.com/", 100), browserTab(1, "https://example.com/", 200)]);
  fakeBrowser.tabs.query = tabsQuery;
  const groupsQuery = vi
    .fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>()
    .mockResolvedValue([browserGroup(100, "開発"), browserGroup(200, "業務")]);
  fakeBrowser.tabGroups.query = groupsQuery;
  const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(100);
  fakeBrowser.tabs.group = group;
  const move = vi.fn<(groupId: number, properties: Browser.tabGroups.MoveProperties) => Promise<undefined>>();
  fakeBrowser.tabGroups.move = move;
  return { tabsQuery, group, move };
}

describe("グループ化とグループの並び", () => {
  it("ルールの順番だけを変えると、グループを動かさずに並びだけを変える", async () => {
    const { group, move } = mockWindow();

    await applyRuleChange([DEV, WORK], [WORK, DEV]);

    expect(group).not.toHaveBeenCalled();
    expect(move).toHaveBeenCalledWith(200, { index: 0 });
  });

  it("並びがすでに正しいときは、グループを移動しない", async () => {
    const { move } = mockWindow();

    await regroupAllWindows([DEV, WORK]);

    expect(move).not.toHaveBeenCalled();
  });

  it("グループ化の操作をしたときは、スナップショットを取り直してから並びを計画する", async () => {
    const { tabsQuery, group } = mockWindow();
    tabsQuery.mockResolvedValueOnce([
      browserTab(0, "https://github.com/", 100),
      browserTab(1, "https://example.com/", 200),
      browserTab(2, "https://github.com/new", -1),
    ]);

    await regroupTabs([DEV, WORK], 1, [12]);

    expect(group).toHaveBeenCalledWith({ groupId: 100, tabIds: [12] });
    expect(tabsQuery).toHaveBeenCalledTimes(2);
  });
});
