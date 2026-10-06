import { describe, expect, it, vi } from "vitest";

import { createMemoryStorageItem } from "../testing/storage";
import { getLogWriter } from "./log-writer";
import type { StoredLogEntry } from "./storage";
import { LOGS_ITEM, MAX_STORED_LOGS, readStoredLogs } from "./storage";

function logEntry(message: string): StoredLogEntry {
  return {
    timestamp: "2026-10-02T01:00:00.000Z",
    level: "debug",
    category: "tabherd.grouping",
    message,
    properties: {},
  };
}

describe("端末へのログの書き込み", () => {
  it("受け取った順に追記する", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    const writer = getLogWriter(item);
    writer.write(logEntry("1"));
    writer.write(logEntry("2"));
    await writer.settled();
    writer.write(logEntry("3"));
    await writer.settled();
    const logs = await readStoredLogs(item);
    expect(logs.map((entry) => entry.message)).toStrictEqual(["1", "2", "3"]);
  });

  it("上限を超えたら古いものから捨てる", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    const writer = getLogWriter(item);
    for (let index = 0; index < MAX_STORED_LOGS + 2; index += 1) {
      writer.write(logEntry(String(index)));
    }
    await writer.settled();
    const logs = await readStoredLogs(item);
    expect(logs).toHaveLength(MAX_STORED_LOGS);
    expect(logs[0]?.message).toBe("2");
    expect(logs.at(-1)?.message).toBe(String(MAX_STORED_LOGS + 1));
  });

  it("保存に失敗しても、次のログを保存する", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(item, "setValue").mockRejectedValueOnce(new Error("容量不足"));
    const writer = getLogWriter(item);
    writer.write(logEntry("失敗する"));
    await writer.settled();
    writer.write(logEntry("保存される"));
    await writer.settled();
    const logs = await readStoredLogs(item);
    expect(logs.map((entry) => entry.message)).toStrictEqual(["保存される"]);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("ログの消去", () => {
  it("消去の前に受け取ったログは消え、後に受け取ったログは残る", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    const writer = getLogWriter(item);
    writer.write(logEntry("消去の前"));
    const cleared = writer.clear();
    writer.write(logEntry("消去の後"));
    await cleared;
    await writer.settled();
    const logs = await readStoredLogs(item);
    expect(logs.map((entry) => entry.message)).toStrictEqual(["消去の後"]);
  });

  it("保存の途中で消去しても、消したログが書き戻されない", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    const writer = getLogWriter(item);
    writer.write(logEntry("保存済み"));
    await writer.settled();
    // 次の保存が、保存済みのログを読む途中で止まるようにする
    const reading = Promise.withResolvers<null>();
    const getValue = item.getValue.bind(item);
    vi.spyOn(item, "getValue").mockImplementationOnce(async () => {
      await reading.promise;
      return getValue();
    });
    writer.write(logEntry("保存の途中"));
    const cleared = writer.clear();
    writer.write(logEntry("消去の後"));
    reading.resolve(null);
    await cleared;
    await writer.settled();
    const logs = await readStoredLogs(item);
    expect(logs.map((entry) => entry.message)).toStrictEqual(["消去の後"]);
  });

  it("消去に失敗したら、消去の依頼が失敗する", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    vi.spyOn(item, "removeValue").mockRejectedValueOnce(new Error("容量不足"));
    const writer = getLogWriter(item);
    await expect(writer.clear()).rejects.toThrow("容量不足");
  });
});
