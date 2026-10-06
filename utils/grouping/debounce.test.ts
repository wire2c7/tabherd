import { describe, expect, it, vi } from "vitest";

import { useFakeTimersInTest } from "../testing/mocks";
import { debounceChanges } from "./debounce";

describe("ルールの変更のデバウンス", () => {
  it("最後の変更から決まった時間が経つまで通知しない", () => {
    // 前提: 300ms のデバウンスで値を変更する
    // 検証: 最後の変更から299ms では呼ばれず、300ms 経つと1回呼ばれる
    useFakeTimersInTest();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const onChange = debounceChanges(300, listener);

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
    const onChange = debounceChanges(300, listener);

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
    const onChange = debounceChanges(300, listener);

    onChange("a", "");
    vi.advanceTimersByTime(300);
    onChange("ab", "a");
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenLastCalledWith("ab", "a");
  });
});
