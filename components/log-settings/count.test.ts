import { describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { StoredLogEntry } from "../../utils/logging/storage";
import { logsItem } from "../../utils/logging/storage";
import type { StoredLogCount } from "./count";
import { canClearLogs, watchStoredLogCount } from "./count";

const ENTRY: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "error",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: {},
};

function loaded(count: number): StoredLogCount {
  return { status: "loaded", count };
}

describe("保存したログの件数", () => {
  it("読み込んだ件数と、変わった後の件数を渡す", async () => {
    fakeBrowser.reset();
    await logsItem.setValue([ENTRY]);
    const counts: StoredLogCount[] = [];
    const unwatch = watchStoredLogCount((count) => {
      counts.push(count);
    });
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    await logsItem.setValue([ENTRY, ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1), loaded(2)]);
    });
    unwatch();
  });

  it("読み込みより先に変更の通知が来たら、読み込んだ古い件数で上書きしない", async () => {
    fakeBrowser.reset();
    // 最初の読み込みが、保存より前の値（0 件）を読んだまま止まるようにする
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    const getValue = vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const counts: StoredLogCount[] = [];
    const unwatch = watchStoredLogCount((count) => {
      counts.push(count);
    });

    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    reading.resolve([]);
    await reading.promise;

    expect(counts).toStrictEqual([loaded(1)]);
    unwatch();
    getValue.mockRestore();
  });
});

describe("保存したログの件数の読み込みの失敗", () => {
  it("最初の読み込みに失敗したら、失敗を渡す", async () => {
    fakeBrowser.reset();
    vi.spyOn(console, "error").mockReturnValue();
    const getValue = vi.spyOn(logsItem, "getValue").mockRejectedValueOnce(new Error("v1 migration failed"));
    const counts: StoredLogCount[] = [];
    const unwatch = watchStoredLogCount((count) => {
      counts.push(count);
    });

    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }]);
    });
    // 失敗の後に変わったら、変わった後の件数を渡す
    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }, loaded(1)]);
    });
    unwatch();
    getValue.mockRestore();
    vi.restoreAllMocks();
  });
});

describe("「ログを消去」を押せるか", () => {
  it.each<[string, StoredLogCount, boolean]>([
    ["読み込み中", { status: "loading" }, false],
    ["0 件", { status: "loaded", count: 0 }, false],
    ["1 件以上", { status: "loaded", count: 1 }, true],
    ["読み込みに失敗した", { status: "failed" }, true],
  ])("%s", (_name, count, expected) => {
    expect(canClearLogs(count)).toBe(expected);
  });
});
