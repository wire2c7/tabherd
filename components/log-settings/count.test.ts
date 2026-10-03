import { describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { StoredLogEntry } from "../../utils/logging/storage";
import { logsItem } from "../../utils/logging/storage";
import { watchStoredLogCount } from "./count";

const ENTRY: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "error",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: {},
};

describe("保存したログの件数", () => {
  it("読み込んだ件数と、変わった後の件数を渡す", async () => {
    fakeBrowser.reset();
    await logsItem.setValue([ENTRY]);
    const counts: number[] = [];
    const unwatch = watchStoredLogCount((count) => {
      counts.push(count);
    });
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([1]);
    });
    await logsItem.setValue([ENTRY, ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([1, 2]);
    });
    unwatch();
  });

  it("読み込みより先に変更の通知が来たら、読み込んだ古い件数で上書きしない", async () => {
    fakeBrowser.reset();
    // 最初の読み込みが、保存より前の値（0 件）を読んだまま止まるようにする
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    const getValue = vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const counts: number[] = [];
    const unwatch = watchStoredLogCount((count) => {
      counts.push(count);
    });

    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([1]);
    });
    reading.resolve([]);
    await reading.promise;

    expect(counts).toStrictEqual([1]);
    unwatch();
    getValue.mockRestore();
  });
});
