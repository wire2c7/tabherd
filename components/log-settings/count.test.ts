import { describe, expect, it, onTestFinished, vi } from "vitest";
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

/** 件数の購読を始め、渡された状態を順に入れた配列を返す。購読はテストの終わりにやめる（テストが失敗してもやめる） */
function watchCounts(): StoredLogCount[] {
  const counts: StoredLogCount[] = [];
  const unwatch = watchStoredLogCount((count) => {
    counts.push(count);
  });
  onTestFinished(unwatch);
  return counts;
}

function loaded(count: number): StoredLogCount {
  return { status: "loaded", count };
}

describe("保存したログの件数", () => {
  it("読み込んだ件数と、変わった後の件数を渡す", async () => {
    fakeBrowser.reset();
    await logsItem.setValue([ENTRY]);
    const counts = watchCounts();
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    await logsItem.setValue([ENTRY, ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1), loaded(2)]);
    });
  });

  it("読み込みより先に変更の通知が来たら、読み込んだ古い件数で上書きしない", async () => {
    fakeBrowser.reset();
    // 最初の読み込みが、保存より前の値（0 件）を読んだまま止まるようにする
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const counts = watchCounts();

    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    reading.resolve([]);
    await reading.promise;

    expect(counts).toStrictEqual([loaded(1)]);
  });

  it("読み込みの途中で購読をやめたら、読み込んだ件数を渡さない", async () => {
    fakeBrowser.reset();
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const listener = vi.fn<(count: StoredLogCount) => void>();
    const unwatch = watchStoredLogCount(listener);

    unwatch();
    reading.resolve([ENTRY]);
    await reading.promise;

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("保存したログの件数の読み込みの失敗", () => {
  it("最初の読み込みに失敗したら、失敗を渡す", async () => {
    fakeBrowser.reset();
    vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(logsItem, "getValue").mockRejectedValueOnce(new Error("v1 migration failed"));
    const counts = watchCounts();

    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }]);
    });
    // 失敗の後に変わったら、変わった後の件数を渡す
    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }, loaded(1)]);
    });
  });
});

describe("壊れた保存データの件数", () => {
  it("保存した値が配列でなければ、読み込みの失敗を渡す", async () => {
    fakeBrowser.reset();
    vi.spyOn(console, "error").mockReturnValue();
    await fakeBrowser.storage.local.set({ logs: { broken: true } });
    const counts = watchCounts();
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }]);
    });
  });

  it("配列でない値に変わったら、読み込みの失敗を渡す", async () => {
    fakeBrowser.reset();
    const counts = watchCounts();
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(0)]);
    });
    await fakeBrowser.storage.local.set({ logs: { broken: true } });
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(0), { status: "failed" }]);
    });
  });
});

describe("「ログを消去」を押せるか", () => {
  it.each<[string, StoredLogCount, boolean]>([
    ["読み込み中", { status: "loading" }, false],
    ["0 件", { status: "loaded", count: 0 }, true],
    ["1 件以上", { status: "loaded", count: 1 }, true],
    ["読み込みに失敗した", { status: "failed" }, true],
  ])("%s", (_name, count, expected) => {
    expect(canClearLogs(count)).toBe(expected);
  });
});
