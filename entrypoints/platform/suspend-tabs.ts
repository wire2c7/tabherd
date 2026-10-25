import type { Browser } from "wxt/browser";
import { browser } from "wxt/browser";

import type { SuspendTab, SuspendTabGroup, SuspendTabsApi } from "../../utils/suspend/tabs";

/** タブを groupId ごとに振り分ける。グループに属さないタブ（groupId: -1）は含めない */
function groupTabsByGroupId(tabs: readonly Browser.tabs.Tab[]): Map<number, SuspendTab[]> {
  const tabsByGroupId = new Map<number, SuspendTab[]>();
  for (const tab of tabs) {
    if (tab.groupId >= 0) {
      const entry: SuspendTab = { id: tab.id, pinned: tab.pinned, active: tab.active };
      const tabsInGroup = tabsByGroupId.get(tab.groupId);
      if (tabsInGroup === undefined) {
        tabsByGroupId.set(tab.groupId, [entry]);
      } else {
        tabsInGroup.push(entry);
      }
    }
  }
  return tabsByGroupId;
}

/** WXT の browser による SuspendTabsApi */
export const browserSuspendTabs: SuspendTabsApi = {
  // popup は特定のウィンドウに紐づいて開くため、そのウィンドウのタブグループだけを対象にする
  queryWindowGroups: async (): Promise<SuspendTabGroup[]> => {
    const window = await browser.windows.getCurrent();
    if (window.id === undefined) {
      return [];
    }
    const windowId = window.id;
    const [groups, tabs] = await Promise.all([browser.tabGroups.query({ windowId }), browser.tabs.query({ windowId })]);
    const tabsByGroupId = groupTabsByGroupId(tabs);
    return groups.map((group) => ({
      id: group.id,
      windowId: group.windowId,
      title: group.title,
      color: group.color,
      tabs: tabsByGroupId.get(group.id) ?? [],
    }));
  },
  discardTabs: async (tabIds) => {
    const results = await Promise.allSettled(
      tabIds.map(async (tabId) => {
        await browser.tabs.discard(tabId);
      }),
    );
    const failedTabIds = tabIds.filter((_, index) => results[index]?.status === "rejected");
    if (failedTabIds.length > 0) {
      throw new Error(`タブのサスペンドに失敗しました: ${failedTabIds.join(", ")}`);
    }
  },
};
