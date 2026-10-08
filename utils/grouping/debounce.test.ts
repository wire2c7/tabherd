import { describe, expect, it, vi } from "vitest";

import { useFakeTimersInTest } from "../testing/mocks";
import { debounceChanges } from "./debounce";

describe("値の変更をまとめる区間", () => {
  it("最初の変更なら、区間が確定するまで待つPromiseを返す", async () => {
    // 前提: onChange を初めて呼ぶ
    // 検証: 戻り値の Promise は300ms経つまで解決せず、経つと最初の変更前・最後の変更後の値で解決する
    useFakeTimersInTest();
    const onChange = debounceChanges<string>(300);

    const settled = onChange("a", "");
    expect(settled).toBeDefined();
    let resolved: unknown;
    void (async () => {
      resolved = await settled;
    })();
    await vi.advanceTimersByTimeAsync(299);
    expect(resolved).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toStrictEqual({ oldValue: "", newValue: "a" });
  });

  it("区間の途中の変更は undefined を返し、最後の変更後の値を区間の確定に使う", async () => {
    // 前提: 300ms 以内に3回続けて onChange を呼ぶ
    // 検証: 2回目以降は undefined を返す。最初の呼び出しの Promise は、最初の変更前の値と最後の変更後の値で解決する
    useFakeTimersInTest();
    const onChange = debounceChanges<string>(300);

    const settled = onChange("a", "");
    expect(onChange("ab", "a")).toBeUndefined();
    expect(onChange("abc", "ab")).toBeUndefined();
    await vi.advanceTimersByTimeAsync(300);
    await expect(settled).resolves.toStrictEqual({ oldValue: "", newValue: "abc" });
  });

  it("確定した後の変更は、新しい区間として別の Promise を返す", async () => {
    // 前提: 1回目の区間が確定してから2回目の onChange を呼ぶ
    // 検証: 2回目の呼び出しは新しい Promise を返し、2回目の変更前・変更後の値で解決する
    useFakeTimersInTest();
    const onChange = debounceChanges<string>(300);

    const first = onChange("a", "");
    await vi.advanceTimersByTimeAsync(300);
    await expect(first).resolves.toStrictEqual({ oldValue: "", newValue: "a" });

    const second = onChange("ab", "a");
    expect(second).not.toBe(first);
    await vi.advanceTimersByTimeAsync(300);
    await expect(second).resolves.toStrictEqual({ oldValue: "a", newValue: "ab" });
  });
});

describe("保留中の区間のタスクが遅れて実行される場合", () => {
  it("次の区間は、前の区間のPromiseを待たずに正しい値で別のPromiseを確定する", async () => {
    // 前提: 1回目の区間が確定した後（Promiseはまだ誰も待っていない）、2回目のonChangeを呼ぶ
    // 検証: 1回目の確定時点の値を失わず、2回目は2回目の変更前・変更後の値で確定する
    //       （isBurstPendingのような外部の状態に頼らず、区間ごとに正しく確定することを確かめる）
    useFakeTimersInTest();
    const onChange = debounceChanges<string>(300);

    const first = onChange("a", "");
    await vi.advanceTimersByTimeAsync(300);
    // ここでまだ first を await していない（反映タスクが詰まっている状況に相当）

    const second = onChange("ab", "a");
    await vi.advanceTimersByTimeAsync(300);

    await expect(first).resolves.toStrictEqual({ oldValue: "", newValue: "a" });
    await expect(second).resolves.toStrictEqual({ oldValue: "a", newValue: "ab" });
  });
});
