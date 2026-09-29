import { describe, expect, it, vi } from "vitest";

import { createSerialQueue } from "./serial";

describe("処理の直列化", () => {
  it("前の処理が終わってから次の処理を始める", async () => {
    const enqueue = createSerialQueue();
    const log: string[] = [];
    const { promise: firstGate, resolve: openFirst } = Promise.withResolvers<boolean>();

    const first = enqueue(async () => {
      log.push("1 開始");
      await firstGate;
      log.push("1 終了");
    });
    const second = enqueue(
      vi.fn<() => Promise<void>>().mockImplementation(async () => {
        log.push("2 開始");
        await Promise.resolve();
      }),
    );

    await Promise.resolve();
    expect(log).toStrictEqual(["1 開始"]);
    openFirst(true);
    await Promise.all([first, second]);
    expect(log).toStrictEqual(["1 開始", "1 終了", "2 開始"]);
  });

  it("処理が失敗してもログに出し、次の処理を続ける", async () => {
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const enqueue = createSerialQueue();
    const next = vi.fn<() => Promise<void>>().mockResolvedValue();

    const failed = enqueue(vi.fn<() => Promise<void>>().mockRejectedValue(new Error("失敗")));
    await expect(failed).resolves.toBeUndefined();
    await enqueue(next);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
