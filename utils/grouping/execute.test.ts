import { describe, expect, it, vi } from "vitest";

import { captureLogs } from "../logging/testing/capture";
import { useFakeTimersInTest } from "../testing/mocks";
import { RETRY_DELAYS_MS, executeOperations, retryWhileTabsBusy, toLoggedOperation } from "./execute";
import { createMockTabsApi } from "./testing/tabs";
import type { GroupOperation } from "./types";

const busyError = new Error("Tabs cannot be edited right now (user may be dragging a tab).");

function busyTwiceThenOk() {
  return vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(busyError)
    .mockRejectedValueOnce(busyError)
    .mockResolvedValue("ok");
}

describe("タブの編集ができないときのリトライ", () => {
  it("成功すればやり直さない", async () => {
    // 前提: action が最初から成功する
    // 検証: 結果がそのまま解決し、action は1回しか呼ばれない
    const action = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
    await expect(retryWhileTabsBusy(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("ほかのエラーのときはやり直さない", async () => {
    // 前提: action が「タブを編集できない」以外のエラーで拒否する
    // 検証: そのエラーのまま拒否され、やり直さずに1回しか呼ばれない
    const error = new Error("No tab with id: 10.");
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(error);
    await expect(retryWhileTabsBusy(action)).rejects.toThrow(error);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("待ち時間は 100ms から倍々に、5回までやり直す", () => {
    // 検証: RETRY_DELAYS_MS が [100, 200, 400, 800, 1600] である
    expect(RETRY_DELAYS_MS).toStrictEqual([100, 200, 400, 800, 1600]);
  });
});

describe("リトライの待ち時間", () => {
  it("1回目は 100ms 待ってやり直す", async () => {
    // 前提: action が2回「タブを編集できない」エラーで拒否した後に成功する
    // 検証: 99ms では2回目を呼ばず、100ms 経つと2回目を呼び、最終的に成功する
    useFakeTimersInTest();
    const action = busyTwiceThenOk();
    const result = retryWhileTabsBusy(action);

    await vi.advanceTimersByTimeAsync(99);
    expect(action).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(action).toHaveBeenCalledTimes(2);

    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("ok");
  });

  it("2回目は、さらに 200ms 待ってやり直す", async () => {
    // 前提: action が2回「タブを編集できない」エラーで拒否した後に成功する
    // 検証: 1回目の待ち時間（100ms）の後、さらに199ms では3回目を呼ばず、200ms 経つと3回目を呼び、最終的に成功する
    useFakeTimersInTest();
    const action = busyTwiceThenOk();
    const result = retryWhileTabsBusy(action);

    await vi.advanceTimersByTimeAsync(100 + 199);
    expect(action).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(action).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toBe("ok");
  });

  it("やり直しても失敗し続けるときは、5回やり直した後にエラーを投げる", async () => {
    // 前提: action が常に「タブを編集できない」エラーで拒否する
    // 検証: 全待ち時間の合計（3100ms）が経つと、そのエラーで拒否され、合計6回（初回+5回のやり直し）呼ばれる
    useFakeTimersInTest();
    const action = vi.fn<() => Promise<string>>().mockRejectedValue(busyError);
    // 待っているあいだに拒否されても未処理の拒否にならないよう、時間を進める前に expect を付ける
    await Promise.all([
      expect(retryWhileTabsBusy(action)).rejects.toThrow(busyError),
      vi.advanceTimersByTimeAsync(100 + 200 + 400 + 800 + 1600),
    ]);
    expect(action).toHaveBeenCalledTimes(6);
  });
});

describe("計画の実行", () => {
  it("グループを作ってから、タイトル・色を付ける", async () => {
    // 前提: create-group 操作を1件実行し、api.group がグループ ID 100 を返す
    // 検証: api.group が指定したタブ・ウィンドウで呼ばれ、api.updateGroup がそのグループ ID にタイトル・色を設定して呼ばれる
    const api = createMockTabsApi();
    api.group.mockResolvedValue(100);

    await executeOperations(api, [
      { type: "create-group", windowId: 1, title: "開発", color: "blue", tabIds: [10, 11] },
    ]);

    expect(api.group).toHaveBeenCalledWith([10, 11], { windowId: 1 });
    expect(api.updateGroup).toHaveBeenCalledWith(100, { title: "開発", color: "blue" });
  });

  it("既存のグループへ入れる・外す・タイトルと色を変える", async () => {
    // 前提: ungroup・add-to-group・update-group の3操作を実行する
    // 検証: それぞれ対応する api（ungroup・group・updateGroup）が指定した引数で呼ばれる
    const api = createMockTabsApi();

    await executeOperations(api, [
      { type: "ungroup", tabIds: [12] },
      { type: "add-to-group", groupId: 100, tabIds: [10] },
      { type: "update-group", groupId: 200, title: "Dev", color: "red" },
    ]);

    expect(api.ungroup).toHaveBeenCalledWith([12]);
    expect(api.group).toHaveBeenCalledWith([10], { groupId: 100 });
    expect(api.updateGroup).toHaveBeenCalledWith(200, { title: "Dev", color: "red" });
  });

  it("グループを移動する", async () => {
    // 前提: move-group 操作を1件実行する
    // 検証: api.moveGroup が指定したグループ ID・位置で呼ばれる
    const api = createMockTabsApi();

    await executeOperations(api, [{ type: "move-group", groupId: 200, index: 2 }]);

    expect(api.moveGroup).toHaveBeenCalledWith(200, 2);
  });
});

describe("操作の失敗", () => {
  it("操作が失敗しても、ログに出して残りの操作を続ける", async () => {
    // 前提: ungroup 操作が失敗するよう仕込み、その後に add-to-group 操作を続ける
    // 検証: 失敗した操作とエラーが error レベルでログに残り、後続の add-to-group 操作は実行される
    const logs = captureLogs();
    const api = createMockTabsApi();
    api.ungroup.mockRejectedValue(new Error("No tab with id: 12."));

    await executeOperations(api, [
      { type: "ungroup", tabIds: [12] },
      { type: "add-to-group", groupId: 100, tabIds: [10] },
    ]);

    expect(logs.filter((record) => record.level === "error").map((record) => record.properties)).toStrictEqual([
      { operation: { type: "ungroup", tabIds: [12] }, error: new Error("No tab with id: 12.") },
    ]);
    expect(api.group).toHaveBeenCalledWith([10], { groupId: 100 });
  });
});

describe("ログに出す操作", () => {
  it("グループを作る操作からタイトル・色を除く", () => {
    // 前提: create-group 操作にタイトル・色が含まれる
    // 検証: 変換後はタイトル・色が除かれ、windowId・tabIds だけが残る
    expect(
      toLoggedOperation({ type: "create-group", windowId: 1, title: "業務", color: "red", tabIds: [10, 11] }),
    ).toStrictEqual({ type: "create-group", windowId: 1, tabIds: [10, 11] });
  });

  it("グループを変える操作からタイトル・色を除く", () => {
    // 前提: update-group 操作にタイトル・色が含まれる
    // 検証: 変換後はタイトル・色が除かれ、groupId だけが残る
    expect(toLoggedOperation({ type: "update-group", groupId: 100, title: "業務", color: "red" })).toStrictEqual({
      type: "update-group",
      groupId: 100,
    });
  });

  it("グループへ入れる・外す・移動する操作は、ID と位置だけを出す", () => {
    // 前提: add-to-group・ungroup・move-group の3種の操作を変換する（タイトル・色を持たない操作）
    // 検証: いずれも変換前と同じ groupId・tabIds・index がそのまま出る
    expect(toLoggedOperation({ type: "add-to-group", groupId: 100, tabIds: [10] })).toStrictEqual({
      type: "add-to-group",
      groupId: 100,
      tabIds: [10],
    });
    expect(toLoggedOperation({ type: "ungroup", tabIds: [10, 11] })).toStrictEqual({
      type: "ungroup",
      tabIds: [10, 11],
    });
    expect(toLoggedOperation({ type: "move-group", groupId: 100, index: 2 })).toStrictEqual({
      type: "move-group",
      groupId: 100,
      index: 2,
    });
  });

  it("操作に決めていないフィールドがあっても出さない", () => {
    // 前提: 操作の型に後からフィールドが足された場合を、型の余分なプロパティとして再現する（ungroup 操作に無関係な title を付与）
    // 検証: 変換後にその余分なフィールド（title）が出力に含まれない
    const operation: GroupOperation & { title: string } = { type: "ungroup", tabIds: [10], title: "秘密の案件" };
    expect(toLoggedOperation(operation)).toStrictEqual({ type: "ungroup", tabIds: [10] });
  });
});
