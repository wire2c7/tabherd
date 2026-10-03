import { resetSync } from "@logtape/logtape";
import { describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { captureLogs } from "../logging/testing/capture";
import { RETRY_DELAYS_MS, executeOperations, retryWhileTabsBusy, toLoggedOperation } from "./execute";

const busyError = new Error("Tabs cannot be edited right now (user may be dragging a tab).");

function busyTwiceThenOk() {
  return vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(busyError)
    .mockRejectedValueOnce(busyError)
    .mockResolvedValue("ok");
}

// fake-browser の tabs.group 等はモックされていないため、テストごとに差し替える。
// vi.spyOn ではコールバック版のオーバーロードの型になるため、Promise 版の型の関数を代入する
function mockTabsGroup(groupId: number) {
  const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(groupId);
  fakeBrowser.tabs.group = group;
  return group;
}

function mockTabsUngroup() {
  const ungroup = vi.fn<(tabIds: number | [number, ...number[]]) => Promise<undefined>>();
  fakeBrowser.tabs.ungroup = ungroup;
  return ungroup;
}

function mockTabGroupsUpdate() {
  const update = vi.fn<(groupId: number, properties: Browser.tabGroups.UpdateProperties) => Promise<undefined>>();
  fakeBrowser.tabGroups.update = update;
  return update;
}

describe("タブの編集ができないときのリトライ", () => {
  it("成功すればやり直さない", async () => {
    const action = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
    await expect(retryWhileTabsBusy(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ほかのエラーのときはやり直さない", async () => {
    const error = new Error("No tab with id: 10.");
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    await expect(retryWhileTabsBusy(action)).rejects.toThrow(error);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("待ち時間は 100ms から倍々に、5回までやり直す", () => {
    expect(RETRY_DELAYS_MS).toStrictEqual([100, 200, 400, 800, 1600]);
  });
});

describe("リトライの待ち時間", () => {
  it("1回目は 100ms 待ってやり直す", async () => {
    vi.useFakeTimers();
    const action = busyTwiceThenOk();
    const result = retryWhileTabsBusy(action);

    await vi.advanceTimersByTimeAsync(99);
    expect(action).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(action).toHaveBeenCalledTimes(2);

    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("ok");
    vi.useRealTimers();
  });

  it("2回目は、さらに 200ms 待ってやり直す", async () => {
    vi.useFakeTimers();
    const action = busyTwiceThenOk();
    const result = retryWhileTabsBusy(action);

    await vi.advanceTimersByTimeAsync(100 + 199);
    expect(action).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(action).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toBe("ok");
    vi.useRealTimers();
  });

  it("やり直しても失敗し続けるときは、5回やり直した後にエラーを投げる", async () => {
    vi.useFakeTimers();
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(busyError);
    // 待っているあいだに拒否されても未処理の拒否にならないよう、時間を進める前に expect を付ける
    await Promise.all([
      expect(retryWhileTabsBusy(action)).rejects.toThrow(busyError),
      vi.advanceTimersByTimeAsync(100 + 200 + 400 + 800 + 1600),
    ]);
    expect(action).toHaveBeenCalledTimes(6);
    vi.useRealTimers();
  });
});

function mockTabGroupsMove() {
  const move = vi.fn<(groupId: number, properties: Browser.tabGroups.MoveProperties) => Promise<undefined>>();
  fakeBrowser.tabGroups.move = move;
  return move;
}

describe("計画の実行", () => {
  it("グループを作ってから、タイトル・色を付ける", async () => {
    const group = mockTabsGroup(100);
    const update = mockTabGroupsUpdate();

    await executeOperations([{ type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10, 11] }]);

    expect(group).toHaveBeenCalledWith({ createProperties: { windowId: 1 }, tabIds: [10, 11] });
    expect(update).toHaveBeenCalledWith(100, { title: "開発", color: "blue" });
  });

  it("既存のグループへ入れる・外す・タイトルと色を変える", async () => {
    const group = mockTabsGroup(100);
    const ungroup = mockTabsUngroup();
    const update = mockTabGroupsUpdate();

    await executeOperations([
      { type: "ungroup", tabIds: [12] },
      { type: "add-to-group", groupId: 100, tabIds: [10] },
      { type: "update-group", groupId: 200, title: "Dev", color: "red" },
    ]);

    expect(ungroup).toHaveBeenCalledWith([12]);
    expect(group).toHaveBeenCalledWith({ groupId: 100, tabIds: [10] });
    expect(update).toHaveBeenCalledWith(200, { title: "Dev", color: "red" });
  });

  it("グループを移動する", async () => {
    const move = mockTabGroupsMove();

    await executeOperations([{ type: "move-group", groupId: 200, index: 2 }]);

    expect(move).toHaveBeenCalledWith(200, { index: 2 });
  });
});

describe("操作の失敗", () => {
  it("操作が失敗しても、ログに出して残りの操作を続ける", async () => {
    const logs = captureLogs();
    mockTabsUngroup().mockRejectedValue(new Error("No tab with id: 12."));
    const group = mockTabsGroup(100);

    await executeOperations([
      { type: "ungroup", tabIds: [12] },
      { type: "add-to-group", groupId: 100, tabIds: [10] },
    ]);

    expect(logs.filter((record) => record.level === "error").map((record) => record.properties)).toStrictEqual([
      { operation: { type: "ungroup", tabIds: [12] }, error: new Error("No tab with id: 12.") },
    ]);
    expect(group).toHaveBeenCalledWith({ groupId: 100, tabIds: [10] });
    resetSync();
  });
});

describe("ログに出す操作", () => {
  it("グループを作る操作からタイトル・色を除く", () => {
    expect(
      toLoggedOperation({ type: "create-group", windowId: 1, title: "業務", color: "red", tabIds: [10, 11] }),
    ).toStrictEqual({ type: "create-group", windowId: 1, tabIds: [10, 11] });
  });

  it("グループを変える操作からタイトル・色を除く", () => {
    expect(toLoggedOperation({ type: "update-group", groupId: 100, title: "業務", color: "red" })).toStrictEqual({
      type: "update-group",
      groupId: 100,
    });
  });

  it("タイトルを持たない操作はそのまま出す", () => {
    const operation = { type: "move-group", groupId: 100, index: 2 } as const;
    expect(toLoggedOperation(operation)).toBe(operation);
  });
});
