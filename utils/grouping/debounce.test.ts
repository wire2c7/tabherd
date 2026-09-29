import { describe, expect, it, vi } from "vitest";

import { debounceChanges } from "./debounce";

describe("ルールの変更のデバウンス", () => {
  it("最後の変更から決まった時間が経つまで通知しない", () => {
    vi.useFakeTimers();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const onChange = debounceChanges(300, listener);

    onChange("a", "");
    vi.advanceTimersByTime(200);
    onChange("ab", "a");
    vi.advanceTimersByTime(299);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("まとめた変更の最初の変更前の値と、最後の変更後の値を渡す", () => {
    vi.useFakeTimers();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const onChange = debounceChanges(300, listener);

    onChange("a", "");
    onChange("ab", "a");
    onChange("abc", "ab");
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledWith("abc", "");
    vi.useRealTimers();
  });

  it("通知した後の変更は、その変更前の値から数え直す", () => {
    vi.useFakeTimers();
    const listener = vi.fn<(newValue: string, oldValue: string) => void>();
    const onChange = debounceChanges(300, listener);

    onChange("a", "");
    vi.advanceTimersByTime(300);
    onChange("ab", "a");
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenLastCalledWith("ab", "a");
    vi.useRealTimers();
  });
});
