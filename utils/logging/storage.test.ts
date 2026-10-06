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
    // 前提: ENTRY を1件保存した StorageItem
    // 検証: 保存した内容がそのまま返る
    const item = createMemoryStorageItem(LOGS_ITEM);
    await item.setValue([ENTRY]);
    await expect(readStoredLogs(item)).resolves.toStrictEqual([ENTRY]);
  });

  it("保存した値が配列でなければ、例外を投げる", async () => {
    // 前提: 配列ではない値（{ broken: true }）が保存されている
    // 検証: TypeError を投げる
    const item = createMemoryStorageItem(LOGS_ITEM);
    item.store({ broken: true });
    await expect(readStoredLogs(item)).rejects.toThrow(TypeError);
  });
});

describe("保存したログへの追記", () => {
  it("保存した値が配列でなければ、捨てて追記したログだけを保存する", async () => {
    // 前提: 配列ではない値（{ broken: true }）が保存されている状態で ENTRY を追記する
    // 検証: 元の壊れた値は捨てられ、追記した ENTRY だけが保存される
    const item = createMemoryStorageItem(LOGS_ITEM);
    item.store({ broken: true });
    await appendLogs(item, [ENTRY]);
    await expect(readStoredLogs(item)).resolves.toStrictEqual([ENTRY]);
  });
});
