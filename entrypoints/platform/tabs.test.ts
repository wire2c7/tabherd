import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { browserTabs } from "./tabs";

/**
 * fake-browser の tabs.group 等はモックされていないため、テストごとに差し替える。
 * テストの終わりに元の値へ戻す（.claude/rules/typescript.md）。
 * vi.spyOn ではコールバック版のオーバーロードの型になるため、Promise 版の型の関数を代入する
 */
function stub<T, K extends keyof T>(target: T, key: K, value: T[K]): void {
  const original = target[key];
  target[key] = value;
  onTestFinished(() => {
    target[key] = original;
  });
}

describe("browser による TabsApi", () => {
  it("タブは通常のウィンドウだけを、ウィンドウを指定したときはそのウィンドウだけを取得する", async () => {
    const query = vi.fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>().mockResolvedValue([]);
    stub(fakeBrowser.tabs, "query", query);
    await browserTabs.queryTabs();
    await browserTabs.queryTabs(1);
    expect(query.mock.calls).toStrictEqual([[{ windowType: "normal" }], [{ windowId: 1, windowType: "normal" }]]);
  });

  it("タブグループは、ウィンドウを指定したときだけそのウィンドウに絞る", async () => {
    const query = vi
      .fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>()
      .mockResolvedValue([]);
    stub(fakeBrowser.tabGroups, "query", query);
    await browserTabs.queryGroups();
    await browserTabs.queryGroups(1);
    expect(query.mock.calls).toStrictEqual([[{}], [{ windowId: 1 }]]);
  });

  it("既存のグループへ入れるときは groupId、新しく作るときは createProperties の windowId を渡す", async () => {
    const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(100);
    stub(fakeBrowser.tabs, "group", group);
    await expect(browserTabs.group([10], { groupId: 100 })).resolves.toBe(100);
    await browserTabs.group([11, 12], { windowId: 1 });
    expect(group.mock.calls).toStrictEqual([
      [{ groupId: 100, tabIds: [10] }],
      [{ createProperties: { windowId: 1 }, tabIds: [11, 12] }],
    ]);
  });

  it("グループから外す・タイトルと色を変える・移動する", async () => {
    const ungroup = vi.fn<(tabIds: number | [number, ...number[]]) => Promise<undefined>>();
    const update = vi.fn<(groupId: number, properties: Browser.tabGroups.UpdateProperties) => Promise<undefined>>();
    const move = vi.fn<(groupId: number, properties: Browser.tabGroups.MoveProperties) => Promise<undefined>>();
    stub(fakeBrowser.tabs, "ungroup", ungroup);
    stub(fakeBrowser.tabGroups, "update", update);
    stub(fakeBrowser.tabGroups, "move", move);
    await browserTabs.ungroup([10]);
    await browserTabs.updateGroup(100, { title: "開発", color: "blue" });
    await browserTabs.moveGroup(100, 2);
    expect(ungroup).toHaveBeenCalledWith([10]);
    expect(update).toHaveBeenCalledWith(100, { title: "開発", color: "blue" });
    expect(move).toHaveBeenCalledWith(100, { index: 2 });
  });
});
