import { describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { getLogWriter } from "./log-writer";
import type { StoredLogEntry } from "./storage";
import { MAX_STORED_LOGS, logsItem } from "./storage";

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
    fakeBrowser.reset();
    const writer = getLogWriter();
    writer.write(logEntry("1"));
    writer.write(logEntry("2"));
    await writer.settled();
    writer.write(logEntry("3"));
    await writer.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["1", "2", "3"]);
  });

  it("上限を超えたら古いものから捨てる", async () => {
    fakeBrowser.reset();
    const writer = getLogWriter();
    for (let index = 0; index < MAX_STORED_LOGS + 2; index += 1) {
      writer.write(logEntry(String(index)));
    }
    await writer.settled();
    const logs = await logsItem.getValue();
    expect(logs).toHaveLength(MAX_STORED_LOGS);
    expect(logs[0]?.message).toBe("2");
    expect(logs.at(-1)?.message).toBe(String(MAX_STORED_LOGS + 1));
  });

  it("保存に失敗しても、次のログを保存する", async () => {
    fakeBrowser.reset();
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const setValue = vi.spyOn(logsItem, "setValue").mockRejectedValueOnce(new Error("容量不足"));
    const writer = getLogWriter();
    writer.write(logEntry("失敗する"));
    await writer.settled();
    writer.write(logEntry("保存される"));
    await writer.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["保存される"]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    setValue.mockRestore();
    consoleError.mockRestore();
  });
});

describe("ログの消去", () => {
  it("消去の前に受け取ったログは消え、後に受け取ったログは残る", async () => {
    fakeBrowser.reset();
    const writer = getLogWriter();
    writer.write(logEntry("消去の前"));
    const cleared = writer.clear();
    writer.write(logEntry("消去の後"));
    await cleared;
    await writer.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["消去の後"]);
  });

  it("保存の途中で消去しても、消したログが書き戻されない", async () => {
    fakeBrowser.reset();
    const writer = getLogWriter();
    writer.write(logEntry("保存済み"));
    await writer.settled();
    // 次の保存が、保存済みのログを読む途中で止まるようにする
    const reading = Promise.withResolvers<null>();
    const getValue = logsItem.getValue.bind(logsItem);
    const spy = vi.spyOn(logsItem, "getValue").mockImplementationOnce(async () => {
      await reading.promise;
      return getValue();
    });
    writer.write(logEntry("保存の途中"));
    const cleared = writer.clear();
    writer.write(logEntry("消去の後"));
    reading.resolve(null);
    await cleared;
    await writer.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["消去の後"]);
    spy.mockRestore();
  });

  it("消去に失敗したら、消去の依頼が失敗する", async () => {
    fakeBrowser.reset();
    const removeValue = vi.spyOn(logsItem, "removeValue").mockRejectedValueOnce(new Error("容量不足"));
    const writer = getLogWriter();
    await expect(writer.clear()).rejects.toThrow("容量不足");
    removeValue.mockRestore();
  });
});
