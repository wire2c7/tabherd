import type { Mock } from "vitest";
import { vi } from "vitest";

import type { TabsApi } from "../tabs";

/** メソッドをすべて vi.fn にした TabsApi */
export type MockTabsApi = { [K in keyof TabsApi]: Mock<TabsApi[K]> };

/**
 * テスト用の TabsApi を作る。
 *
 * @returns メソッドをすべて vi.fn にした TabsApi
 * @remarks タブ・グループは無く、操作は何もせずに成功する（group はグループの ID 0 を返す）
 */
export function createMockTabsApi(): MockTabsApi {
  return {
    queryTabs: vi.fn<TabsApi["queryTabs"]>().mockResolvedValue([]),
    queryGroups: vi.fn<TabsApi["queryGroups"]>().mockResolvedValue([]),
    group: vi.fn<TabsApi["group"]>().mockResolvedValue(0),
    ungroup: vi.fn<TabsApi["ungroup"]>().mockResolvedValue(),
    updateGroup: vi.fn<TabsApi["updateGroup"]>().mockResolvedValue(),
    moveGroup: vi.fn<TabsApi["moveGroup"]>().mockResolvedValue(),
  };
}
