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
    // 前提: 2件書いて settled を待ってから、さらに1件書く
    // 検証: 保存されたログが受け取った順（1, 2, 3）に並ぶ
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
    // 前提: 上限より2件多く書く
    // 検証: 保存件数が上限ちょうどになり、最も古い2件が捨てられて残りが順に並ぶ
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
    // 前提: 1回目の保存（setValue）が例外を投げて失敗する
    // 検証: 失敗した1件目は保存されず、2件目は保存され、console.error が1回呼ばれる
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
    // 前提: 1件書いた後に clear を呼び、その直後にもう1件書く
    // 検証: 消去前の1件は残らず、消去後に書いた1件だけが残る
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
    // 前提: 保存中（getValue が保留中）に clear を呼び、保存の完了後にさらに1件書く
    // 検証: 消去前に保存済みだったログは書き戻されず、消去後に書いた1件だけが残る
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
    // 前提: removeValue が例外を投げて失敗する
    // 検証: clear() が返す Promise が同じ理由（"容量不足"）で reject される
    const item = createMemoryStorageItem(LOGS_ITEM);
    vi.spyOn(item, "removeValue").mockRejectedValueOnce(new Error("容量不足"));
    const writer = getLogWriter(item);
    await expect(writer.clear()).rejects.toThrow("容量不足");
  });
});
