import type { LogRecord } from "@logtape/logtape";
import { describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { MAX_STORED_LOGS, logsItem } from "./storage";
import { getStoredLogSink } from "./stored-sink";

function record(message: string): LogRecord {
  return {
    category: ["tabherd", "grouping"],
    level: "debug",
    message: [message],
    rawMessage: message,
    timestamp: 0,
    properties: {},
  };
}

describe("ログを端末に保存する sink", () => {
  it("受け取った順に追記する", async () => {
    fakeBrowser.reset();
    const sink = getStoredLogSink();
    sink(record("1"));
    sink(record("2"));
    await sink.settled();
    sink(record("3"));
    await sink.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["1", "2", "3"]);
  });

  it("上限を超えたら古いものから捨てる", async () => {
    fakeBrowser.reset();
    const sink = getStoredLogSink();
    for (let index = 0; index < MAX_STORED_LOGS + 2; index += 1) {
      sink(record(String(index)));
    }
    await sink.settled();
    const logs = await logsItem.getValue();
    expect(logs).toHaveLength(MAX_STORED_LOGS);
    expect(logs[0]?.message).toBe("2");
    expect(logs.at(-1)?.message).toBe(String(MAX_STORED_LOGS + 1));
  });

  it("保存に失敗しても、次のログを保存する", async () => {
    fakeBrowser.reset();
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    const setValue = vi.spyOn(logsItem, "setValue").mockRejectedValueOnce(new Error("容量不足"));
    const sink = getStoredLogSink();
    sink(record("失敗する"));
    await sink.settled();
    sink(record("保存される"));
    await sink.settled();
    const logs = await logsItem.getValue();
    expect(logs.map((entry) => entry.message)).toStrictEqual(["保存される"]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    setValue.mockRestore();
    consoleError.mockRestore();
  });
});
