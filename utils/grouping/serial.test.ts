import { describe, expect, it, vi } from "vitest";

import { captureLogs } from "../logging/testing/capture";

import { createSerialQueue } from "./serial";

describe("処理の直列化", () => {
  it("前の処理が終わってから次の処理を始める", async () => {
    // 前提: 1つ目の処理が外部からの解決（openFirst）を待っている間に、2つ目の処理を続けて積む
    // 検証: 1つ目が終わる前は2つ目が始まらず、1つ目が終わって初めて2つ目が始まる（ログの順序が「1 開始」「1 終了」「2 開始」になる）
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
    // 前提: 1つ目の処理が失敗（reject）し、その後に2つ目の処理を積む
    // 検証: enqueue した Promise 自体は失敗せずに解決し、失敗は error レベルでログに残り、2つ目の処理は1回呼ばれる
    const logs = captureLogs();
    const enqueue = createSerialQueue();
    const next = vi.fn<() => Promise<void>>().mockResolvedValue();

    const failed = enqueue(vi.fn<() => Promise<void>>().mockRejectedValue(new Error("失敗")));
    await expect(failed).resolves.toBeUndefined();
    await enqueue(next);

    expect(logs.map((record) => [record.level, record.properties])).toStrictEqual([
      ["error", { error: new Error("失敗") }],
    ]);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
