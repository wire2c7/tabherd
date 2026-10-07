import { describe, expect, it, vi } from "vitest";

import { useFakeTimersInTest } from "../testing/mocks";
import { createSettleGate } from "./debounce";

describe("進行中のデバウンスの確定待ち", () => {
  it("保留中の変更が無ければ、待たずに解決する", async () => {
    // 前提: touch を一度も呼んでいない
    // 検証: waitUntilSettled() が即座に解決する
    useFakeTimersInTest();
    const { waitUntilSettled } = createSettleGate(300);
    await expect(waitUntilSettled()).resolves.toBeUndefined();
  });

  it("最後の touch から決まった時間が経つまで解決しない", async () => {
    // 前提: touch を呼んだ直後に waitUntilSettled() を呼ぶ
    // 検証: 299ms では解決せず、300ms 経つと解決する
    useFakeTimersInTest();
    const { touch, waitUntilSettled } = createSettleGate(300);

    touch();
    let settled = false;
    void (async () => {
      await waitUntilSettled();
      settled = true;
    })();
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it("確定するまでの touch は、最後の touch から数え直す", async () => {
    // 前提: 300ms 以内に touch を2回続けて呼ぶ
    // 検証: 1回目から300ms経っても解決せず、2回目から300ms経つと解決する
    useFakeTimersInTest();
    const { touch, waitUntilSettled } = createSettleGate(300);

    touch();
    let settled = false;
    void (async () => {
      await waitUntilSettled();
      settled = true;
    })();
    await vi.advanceTimersByTimeAsync(200);
    touch();
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });
});

describe("確定を待ち終えた後の進行中のデバウンスの確定待ち", () => {
  it("確定した後の touch は、新しく確定を待てる", async () => {
    // 前提: 1回目の確定を待ち終えてから2回目の touch をする
    // 検証: 2回目の touch からも300ms待つと解決する
    useFakeTimersInTest();
    const { touch, waitUntilSettled } = createSettleGate(300);

    touch();
    await vi.advanceTimersByTimeAsync(300);
    await waitUntilSettled();

    touch();
    let settled = false;
    void (async () => {
      await waitUntilSettled();
      settled = true;
    })();
    await vi.advanceTimersByTimeAsync(299);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });
});
