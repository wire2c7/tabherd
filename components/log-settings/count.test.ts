import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { StoredLogEntry } from "../../utils/logging/storage";
import { LOGS_ITEM } from "../../utils/logging/storage";
import type { StorageItem } from "../../utils/storage/item";
import { createMemoryStorageItem } from "../../utils/testing/storage";
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
function watchCounts(item: StorageItem<StoredLogEntry[]>): StoredLogCount[] {
  const counts: StoredLogCount[] = [];
  const unwatch = watchStoredLogCount(item, (count) => {
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
    // 前提: 保存領域に 1 件のログを保存してから購読を始め、その後 2 件に変える
    // 検証: 購読の listener に [loaded(1)] に続き [loaded(1), loaded(2)] が渡る
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    await logsItem.setValue([ENTRY]);
    const counts = watchCounts(logsItem);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    await logsItem.setValue([ENTRY, ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1), loaded(2)]);
    });
  });

  it("読み込みより先に変更の通知が来たら、読み込んだ古い件数で上書きしない", async () => {
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    // 前提: 最初の読み込みが、保存より前の値（0 件）を読んだまま止まるようにする
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const counts = watchCounts(logsItem);

    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(1)]);
    });
    reading.resolve([]);
    await reading.promise;

    // 検証: 遅れて解決した古い読み込み（0 件）で上書きされず、変更通知の件数（1 件）のまま
    expect(counts).toStrictEqual([loaded(1)]);
  });

  it("読み込みの途中で購読をやめたら、読み込んだ件数を渡さない", async () => {
    // 前提: 最初の読み込みが完了する前に購読をやめ、その後で読み込みが解決する
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    const reading = Promise.withResolvers<StoredLogEntry[]>();
    vi.spyOn(logsItem, "getValue").mockReturnValueOnce(reading.promise);
    const listener = vi.fn<(count: StoredLogCount) => void>();
    const unwatch = watchStoredLogCount(logsItem, listener);

    unwatch();
    reading.resolve([ENTRY]);
    await reading.promise;

    // 検証: listener が一度も呼ばれない
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("保存したログの件数の読み込みの失敗", () => {
  it("最初の読み込みに失敗したら、失敗を渡す", async () => {
    // 前提: 最初の getValue が例外（移行の失敗）で reject する
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    vi.spyOn(console, "error").mockReturnValue();
    vi.spyOn(logsItem, "getValue").mockRejectedValueOnce(new Error("v1 migration failed"));
    const counts = watchCounts(logsItem);

    // 検証: { status: "failed" } が渡る
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }]);
    });
    // 前提: 失敗の後に保存値が変わる
    // 検証: 失敗の後に変わった件数（loaded(1)）が続けて渡る
    await logsItem.setValue([ENTRY]);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }, loaded(1)]);
    });
  });
});

describe("壊れた保存データの件数", () => {
  it("保存した値が配列でなければ、読み込みの失敗を渡す", async () => {
    // 前提: 保存領域に配列ではない値（{ broken: true }）を直接保存してから購読を始める
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    vi.spyOn(console, "error").mockReturnValue();
    logsItem.store({ broken: true });
    const counts = watchCounts(logsItem);
    // 検証: { status: "failed" } が渡る
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([{ status: "failed" }]);
    });
  });

  it("配列でない値に変わったら、読み込みの失敗を渡す", async () => {
    // 前提: 正常に読み込めた（0 件）後で、保存値が配列ではない値（{ broken: true }）に変わる
    const logsItem = createMemoryStorageItem(LOGS_ITEM);
    const counts = watchCounts(logsItem);
    await vi.waitFor(() => {
      expect(counts).toStrictEqual([loaded(0)]);
    });
    logsItem.store({ broken: true });
    // 検証: loaded(0) に続いて { status: "failed" } が渡る
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
    // 前提: it.each の各行が示す件数の状態（読み込み中・0 件・1 件以上・読み込み失敗）
    // 検証: canClearLogs がその行の expected（ボタンを押せるか）を返す
    expect(canClearLogs(count)).toBe(expected);
  });
});
