import { describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { StoredLogEntry } from "./storage";
import { appendLogs, logsItem, readStoredLogs } from "./storage";

const ENTRY: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "error",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: {},
};

/** 保存した値を壊す（WXT の storage の `local:logs` は、chrome.storage.local の `logs` に保存される） */
async function breakStoredLogs(): Promise<void> {
  await fakeBrowser.storage.local.set({ logs: { broken: true } });
}

describe("保存したログの読み込み", () => {
  it("保存したログを返す", async () => {
    fakeBrowser.reset();
    await logsItem.setValue([ENTRY]);
    await expect(readStoredLogs()).resolves.toStrictEqual([ENTRY]);
  });

  it("保存した値が配列でなければ、例外を投げる", async () => {
    fakeBrowser.reset();
    await breakStoredLogs();
    await expect(readStoredLogs()).rejects.toThrow(TypeError);
  });
});

describe("保存したログへの追記", () => {
  it("保存した値が配列でなければ、捨てて追記したログだけを保存する", async () => {
    fakeBrowser.reset();
    await breakStoredLogs();
    await appendLogs([ENTRY]);
    await expect(readStoredLogs()).resolves.toStrictEqual([ENTRY]);
  });
});
