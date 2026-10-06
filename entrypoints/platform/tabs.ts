import { browser } from "wxt/browser";

import type { TabsApi } from "../../utils/grouping/tabs";

/** WXT の browser による TabsApi */
export const browserTabs: TabsApi = {
  // タブグループは通常のウィンドウにしか作れないため、ポップアップ等のウィンドウのタブは返さない
  queryTabs: async (windowId) =>
    browser.tabs.query(windowId === undefined ? { windowType: "normal" } : { windowId, windowType: "normal" }),
  queryGroups: async (windowId) => browser.tabGroups.query(windowId === undefined ? {} : { windowId }),
  group: async (tabIds, target) =>
    browser.tabs.group(
      "groupId" in target
        ? { groupId: target.groupId, tabIds }
        : { createProperties: { windowId: target.windowId }, tabIds },
    ),
  ungroup: async (tabIds) => {
    await browser.tabs.ungroup(tabIds);
  },
  updateGroup: async (groupId, properties) => {
    await browser.tabGroups.update(groupId, properties);
  },
  moveGroup: async (groupId, index) => {
    await browser.tabGroups.move(groupId, { index });
  },
};
