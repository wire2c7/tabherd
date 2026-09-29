import { browser } from "wxt/browser";

import type { WindowSnapshot } from "./types";

/**
 * 通常のウィンドウのスナップショットを取る。windowId を省略するとすべての通常のウィンドウを対象にする。
 * タブグループは通常のウィンドウにしか作れないため、ポップアップ等のウィンドウは含めない
 */
export async function takeWindowSnapshots(windowId?: number): Promise<WindowSnapshot[]> {
  const filter = windowId === undefined ? {} : { windowId };
  const [tabs, groups] = await Promise.all([
    browser.tabs.query({ ...filter, windowType: "normal" }),
    browser.tabGroups.query(filter),
  ]);

  const windows = new Map<number, WindowSnapshot>();
  for (const tab of tabs.toSorted((a, b) => a.index - b.index)) {
    // 開発者ツール等、ID を持たないタブはグループに入れられない
    if (tab.id !== undefined) {
      let window = windows.get(tab.windowId);
      if (window === undefined) {
        window = { id: tab.windowId, tabs: [], groups: [] };
        windows.set(tab.windowId, window);
      }
      window.tabs.push({ id: tab.id, url: tab.url ?? "", pinned: tab.pinned, groupId: tab.groupId });
    }
  }
  for (const group of groups) {
    windows.get(group.windowId)?.groups.push({ id: group.id, title: group.title ?? "", color: group.color });
  }
  return [...windows.values()];
}
