import { describe, expect, it, vi } from "vitest";

import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import type { SuspendTabsApi } from "../../utils/suspend/tabs";
import type { GroupView } from "./groups";
import { suspendGroup } from "./suspend";

const GROUP: GroupView = { id: 1, title: "開発", color: "blue", tabCount: 2, targetTabIds: [10, 11] };

function fakeApi(): SuspendTabsApi {
  return {
    queryWindowGroups: vi.fn<SuspendTabsApi["queryWindowGroups"]>(),
    discardTabs: vi.fn<SuspendTabsApi["discardTabs"]>().mockResolvedValue(),
  };
}

function fakeConfirmStore(confirmEnabled: boolean): SuspendConfirmStore {
  return {
    read: vi.fn<SuspendConfirmStore["read"]>().mockResolvedValue(confirmEnabled),
    write: vi.fn<SuspendConfirmStore["write"]>(),
    watch: vi.fn<SuspendConfirmStore["watch"]>(),
  };
}

describe("グループのサスペンドの実行", () => {
  it("確認表示設定が無効なら確認せずに discardTabs を呼ぶ", async () => {
    // 前提: confirmStore が false / 検証: confirm は呼ばれず、discardTabs に対象タブIDが渡る
    const api = fakeApi();
    const confirm = vi.fn<(message: string) => boolean>();
    await suspendGroup(GROUP, { api, confirmStore: fakeConfirmStore(false), confirm });
    expect(confirm).not.toHaveBeenCalled();
    expect(api.discardTabs).toHaveBeenCalledWith([10, 11]);
  });

  it("確認表示設定が有効で確認すると discardTabs を呼ぶ", async () => {
    // 前提: confirmStore が true、confirm が true を返す / 検証: discardTabs が呼ばれる
    const api = fakeApi();
    const confirm = vi.fn<(message: string) => boolean>().mockReturnValue(true);
    await suspendGroup(GROUP, { api, confirmStore: fakeConfirmStore(true), confirm });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.discardTabs).toHaveBeenCalledWith([10, 11]);
  });

  it("確認で中止すると discardTabs を呼ばない", async () => {
    // 前提: confirmStore が true、confirm が false を返す / 検証: discardTabs は呼ばれない
    const api = fakeApi();
    const confirm = vi.fn<(message: string) => boolean>().mockReturnValue(false);
    await suspendGroup(GROUP, { api, confirmStore: fakeConfirmStore(true), confirm });
    expect(api.discardTabs).not.toHaveBeenCalled();
  });

  it("対象タブが0件なら確認も discardTabs も呼ばない", async () => {
    // 前提: targetTabIds が空 / 検証: confirmStore.read すら呼ばれない
    const api = fakeApi();
    const confirmStore = fakeConfirmStore(true);
    const confirm = vi.fn<(message: string) => boolean>();
    await suspendGroup({ ...GROUP, targetTabIds: [] }, { api, confirmStore, confirm });
    expect(confirmStore.read).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(api.discardTabs).not.toHaveBeenCalled();
  });
});
