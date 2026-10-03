import { describe, expect, it, vi } from "vitest";

import { useFakeTimersInTest } from "../testing/mocks";
import { debounceChanges } from "./debounce";

describe("ルールの変更のデバウンス", () => {
  it("最後の変更から決まった時間が経つまで通知しない", () => {
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
