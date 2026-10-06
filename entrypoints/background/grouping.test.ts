import { describe, expect, it, vi } from "vitest";

import { debounceChanges } from "../../utils/grouping/debounce";
import type { RulesState } from "../../utils/grouping/regroup";
import type { MockTabsApi } from "../../utils/grouping/testing/tabs";
import { createMockTabsApi } from "../../utils/grouping/testing/tabs";
import type { Rule } from "../../utils/rules/types";
import { NO_TITLES } from "../../utils/rules/types";
import { useFakeTimersInTest } from "../../utils/testing/mocks";
import type { RegroupTabDeps } from "./grouping";
import { regroupTab } from "./grouping";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };

/** 「開発」に一致するタブ1枚だけがある、グループの無いウィンドウを返す TabsApi */
function mockSingleTabWindow(): MockTabsApi {
  const api = createMockTabsApi();
  api.queryTabs.mockResolvedValue([
    { id: 10, index: 0, url: "https://example.com/dev/1", groupId: -1, windowId: 1, pinned: false },
  ]);
  api.queryGroups.mockResolvedValue([]);
  api.group.mockResolvedValue(100);
  return api;
}

/** 常に rules を返す、ルールの読み込み関数 */
function readFixedRules(rules: readonly Rule[]): () => Promise<RulesState> {
  return async () => {
    await Promise.resolve();
    return { rules, titles: NO_TITLES };
  };
}

/** 呼び出すたびに、そのとき setRules で設定した最新のルールを返す読み込み関数 */
function createLiveReader(): { read: () => Promise<RulesState>; setRules: (rules: readonly Rule[]) => void } {
  let rules: readonly Rule[] = [];
  return {
    read: async () => {
      await Promise.resolve();
      return { rules, titles: NO_TITLES };
    },
    setRules: (newRules) => {
      rules = newRules;
    },
  };
}

describe("regroupTab とルール変更のデバウンスの重なり", () => {
  it("進行中のデバウンスが確定するまで判定を待ち、確定後の最終的なルールで判定する", async () => {
    // 前提: ルールを保存した直後（デバウンス進行中）にタブイベントが来て、デバウンスの残り時間のうちに色を変える
    // 検証: regroupTab は api.group を呼ばず待ち、デバウンスが確定して初めて、そのときの最終的な色（red）でグループを作る
    useFakeTimersInTest();
    const api = mockSingleTabWindow();

    const { read, setRules } = createLiveReader();
    const { onChange, waitUntilSettled } = debounceChanges<readonly Rule[]>(300, () => {
      // ルール変更側の反映（タイトル保存等）はこのテストの対象外
    });
    const deps: RegroupTabDeps = { api, waitUntilSettled, read };

    // 1. ルールを保存する（デバウンスが始まる）
    setRules([DEV]);
    onChange([DEV], []);
    // 2. 300ms 以内にタブイベントが来て、タブを判定する処理が積まれる
    const task = regroupTab(deps, 1, 10)();
    // デバウンスが確定していないあいだは、判定が進まない（グループ化の操作が出ない）
    await vi.advanceTimersByTimeAsync(100);
    expect(api.group).not.toHaveBeenCalled();
    // 3. デバウンスの残り時間のうちにルールの色を変える
    const dev2 = { ...DEV, color: "red" as const };
    setRules([dev2]);
    onChange([dev2], []);
    // 4. デバウンスが確定するまで進める
    await vi.advanceTimersByTimeAsync(300);
    await task;

    expect(api.group).toHaveBeenCalledWith([10], { windowId: 1 });
    expect(api.updateGroup).toHaveBeenCalledWith(100, { title: "開発", color: "red" });
  });

  it("進行中のデバウンスが無ければ、待たずにそのときのルールで判定する", async () => {
    // 前提: ルールの変更が無く、デバウンスが保留中でない状態でタブイベントが来る
    // 検証: regroupTab はすぐにそのときのルールで判定し、グループを作る
    useFakeTimersInTest();
    const api = mockSingleTabWindow();
    const { waitUntilSettled } = debounceChanges<readonly Rule[]>(300, () => {
      // 保留中の変更が無いため呼ばれない
    });
    const deps: RegroupTabDeps = { api, waitUntilSettled, read: readFixedRules([DEV]) };

    await regroupTab(deps, 1, 10)();

    expect(api.group).toHaveBeenCalledWith([10], { windowId: 1 });
    expect(api.updateGroup).toHaveBeenCalledWith(100, { title: "開発", color: "blue" });
  });
});
