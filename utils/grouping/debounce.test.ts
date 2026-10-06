import { describe, expect, it, vi } from "vitest";

import { useFakeTimersInTest } from "../testing/mocks";
import { debounceChanges } from "./debounce";

describe("ルールの変更のデバウンス", () => {
  it("最後の変更から決まった時間が経つまで通知しない", () => {
    // 前提: 300ms のデバウンスで値を変更する
    // 検証: 最後の変更から299ms では呼ばれず、300ms 経つと1回呼ばれる
    useFakeTimersInTest();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const { onChange } = debounceChanges(300, listener);

    onChange("a", "");
    vi.advanceTimersByTime(200);
    onChange("ab", "a");
    vi.advanceTimersByTime(299);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("まとめた変更の最初の変更前の値と、最後の変更後の値を渡す", () => {
    // 前提: 300ms 以内に3回続けて値を変更する
    // 検証: リスナーには最初の変更前の値（空文字列）と最後の変更後の値（abc）が渡る
    useFakeTimersInTest();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const { onChange } = debounceChanges(300, listener);

    onChange("a", "");
    onChange("ab", "a");
    onChange("abc", "ab");
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledWith("abc", "");
  });

  it("通知した後の変更は、その変更前の値から数え直す", () => {
    // 前提: 1回目の通知が終わってから2回目の変更をする
    // 検証: 2回目の通知には、2回目の変更の前の値（a）と変更後の値（ab）が渡る
    useFakeTimersInTest();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const { onChange } = debounceChanges(300, listener);

    onChange("a", "");
    vi.advanceTimersByTime(300);
    onChange("ab", "a");
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenLastCalledWith("ab", "a");
  });
});

describe("進行中のデバウンスの確定待ち", () => {
  it("保留中の変更が無ければ、待たずに解決する", async () => {
    // 前提: onChange を一度も呼んでいない
    // 検証: waitUntilSettled() が即座に解決する
    useFakeTimersInTest();
    const { waitUntilSettled } = debounceChanges<string>(300, () => {
      // このテストでは呼ばれない
    });
    await expect(waitUntilSettled()).resolves.toBeUndefined();
  });

  it("保留中の変更があれば、確定するまで解決しない", async () => {
    // 前提: onChange を呼んだ直後に waitUntilSettled() を呼ぶ
    // 検証: 299ms では解決せず、300ms 経ってリスナーが呼ばれた後に解決する
    useFakeTimersInTest();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const { onChange, waitUntilSettled } = debounceChanges(300, listener);

    onChange("a", "");
    let settled = false;
    void (async () => {
      await waitUntilSettled();
      settled = true;
    })();
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(settled).toBe(true);
  });

  it("リスナーが例外を投げても解決する", async () => {
    // 前提: リスナーが例外を投げる
    // 検証: 例外はそのまま setTimeout の中で投げられるが、waitUntilSettled() は解決する
    useFakeTimersInTest();
    const { onChange, waitUntilSettled } = debounceChanges<string>(300, () => {
      throw new Error("失敗");
    });

    onChange("a", "");
    let settled = false;
    void (async () => {
      await waitUntilSettled();
      settled = true;
    })();
    await expect(vi.advanceTimersByTimeAsync(300)).rejects.toThrow("失敗");
    expect(settled).toBe(true);
  });
});
