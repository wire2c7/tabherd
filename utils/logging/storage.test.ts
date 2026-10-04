import { describe, expect, it } from "vitest";

import { createMemoryStorageItem } from "../testing/storage";
import type { StoredLogEntry } from "./storage";
import { LOGS_ITEM, appendLogs, readStoredLogs } from "./storage";

const ENTRY: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "error",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: {},
};

describe("保存したログの読み込み", () => {
  it("保存したログを返す", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    await item.setValue([ENTRY]);
    await expect(readStoredLogs(item)).resolves.toStrictEqual([ENTRY]);
  });

  it("保存した値が配列でなければ、例外を投げる", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    item.store({ broken: true });
    await expect(readStoredLogs(item)).rejects.toThrow(TypeError);
  });
});

describe("保存したログへの追記", () => {
  it("保存した値が配列でなければ、捨てて追記したログだけを保存する", async () => {
    const item = createMemoryStorageItem(LOGS_ITEM);
    item.store({ broken: true });
    await appendLogs(item, [ENTRY]);
    await expect(readStoredLogs(item)).resolves.toStrictEqual([ENTRY]);
  });
});
