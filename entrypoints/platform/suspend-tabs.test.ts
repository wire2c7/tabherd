import { describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { stub } from "../../utils/testing/mocks";
import { browserSuspendTabs } from "./suspend-tabs";

/** テストに関わらないプロパティを既定値で埋めた Browser.tabs.Tab */
function makeTab(overrides: Partial<Browser.tabs.Tab> & Pick<Browser.tabs.Tab, "id" | "groupId">): Browser.tabs.Tab {
  return {
    index: 0,
    windowId: 1,
    highlighted: false,
    incognito: false,
    pinned: false,
    active: false,
    frozen: false,
    // oxlint-disable-next-line typescript/no-deprecated -- Tab の必須プロパティのため省略できない
    selected: false,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: 0,
    ...overrides,
  };
}

/** windows.getCurrent を windowId（省略時は ID 無し）を返すよう差し替える */
function stubCurrentWindow(windowId?: number): void {
  stub(
    fakeBrowser.windows,
    "getCurrent",
    vi
      .fn<() => Promise<Browser.windows.Window>>()
      .mockResolvedValue({ id: windowId, focused: true, alwaysOnTop: false, incognito: false }),
  );
}

/** tabGroups.query を groups を返すよう差し替え、呼び出しを記録する Mock を返す */
function stubTabGroupsQuery(
  groups: Browser.tabGroups.TabGroup[],
): ReturnType<typeof vi.fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>> {
  const query = vi
    .fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>()
    .mockResolvedValue(groups);
  stub(fakeBrowser.tabGroups, "query", query);
  return query;
}

/** tabs.query を tabs を返すよう差し替え、呼び出しを記録する Mock を返す */
function stubTabsQuery(
  tabs: Browser.tabs.Tab[],
): ReturnType<typeof vi.fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>> {
  const query = vi.fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>().mockResolvedValue(tabs);
  stub(fakeBrowser.tabs, "query", query);
  return query;
}

describe("browser による SuspendTabsApi", () => {
  it("操作対象のウィンドウのグループと、そのタブだけを返す", async () => {
    // 前提: windows.getCurrent が windowId: 1 を返し、tabGroups.query・tabs.query にも windowId: 1 が渡る
    // 検証: グループごとに、そのグループに属するタブだけがまとめられる
    stubCurrentWindow(1);
    const queryGroups = stubTabGroupsQuery([
      { id: 100, windowId: 1, title: "開発", color: "blue", collapsed: false, shared: false },
    ]);
    const queryTabs = stubTabsQuery([
      makeTab({ groupId: 100, id: 10, pinned: false, active: false }),
      makeTab({ groupId: 100, id: 11, pinned: false, active: true }),
      makeTab({ groupId: -1, id: 12, pinned: false, active: false }),
    ]);

    const groups = await browserSuspendTabs.queryWindowGroups();

    expect(queryGroups.mock.calls).toStrictEqual([[{ windowId: 1 }]]);
    expect(queryTabs.mock.calls).toStrictEqual([[{ windowId: 1 }]]);
    expect(groups).toStrictEqual([
      {
        id: 100,
        windowId: 1,
        title: "開発",
        color: "blue",
        tabs: [
          { id: 10, pinned: false, active: false },
          { id: 11, pinned: false, active: true },
        ],
      },
    ]);
  });

  it("ウィンドウが ID を持たないときは空配列を返す", async () => {
    // 前提: windows.getCurrent が id を持たないウィンドウを返す / 検証: グループ・タブの取得を呼ばずに空配列を返す
    stubCurrentWindow();
    const queryGroups = stubTabGroupsQuery([]);

    await expect(browserSuspendTabs.queryWindowGroups()).resolves.toStrictEqual([]);
    expect(queryGroups).not.toHaveBeenCalled();
  });
});

describe("browser による SuspendTabsApi の discardTabs", () => {
  it("それぞれの ID で tabs.discard を呼ぶ", async () => {
    // 前提/検証: discardTabs([10, 11]) で、tabs.discard が 10・11 それぞれに呼ばれる
    // oxlint-disable-next-line unicorn/no-useless-undefined -- mockResolvedValue は戻り値の型どおり引数が必須
    const discard = vi.fn<(tabId?: number) => Promise<Browser.tabs.Tab | undefined>>().mockResolvedValue(undefined);
    // discard には callback 版の別形の overload もあるため、Promise 版の型にだけ合わせた Mock を unknown 経由で代入する
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 上記の理由で unknown を経由した変換が必要
    stub(fakeBrowser.tabs, "discard", discard as unknown as typeof fakeBrowser.tabs.discard);
    await browserSuspendTabs.discardTabs([10, 11]);
    expect(discard.mock.calls).toStrictEqual([[10], [11]]);
  });
});
