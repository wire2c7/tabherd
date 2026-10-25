import { browser } from "wxt/browser";

import type { SuspendTabGroup, SuspendTabsApi } from "../../utils/suspend/tabs";

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
    return groups.map((group) => ({
      id: group.id,
      windowId: group.windowId,
      title: group.title,
      color: group.color,
      tabs: tabs
        .filter((tab) => tab.groupId === group.id)
        .map((tab) => ({ id: tab.id, pinned: tab.pinned, active: tab.active })),
    }));
  },
  discardTabs: async (tabIds) => {
    await Promise.all(tabIds.map(async (tabId) => browser.tabs.discard(tabId)));
  },
};
