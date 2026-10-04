import type { StoredLogEntry } from "../../utils/logging/storage";
import { isStoredLogs, readStoredLogs } from "../../utils/logging/storage";
import type { StorageItem } from "../../utils/storage/item";

/** 端末に保存したログの件数の状態 */
export type StoredLogCount =
  | { status: "loading" }
  | { status: "loaded"; count: number }
  /** 読み込みに失敗したか、保存した値が壊れている（配列でない） */
  | { status: "failed" };

/**
 * LOGS_ITEM の StorageItem に保存したログの件数の状態を、読み込んだときと変わったときに listener へ渡す。戻り値は購読をやめる関数。
 * 最初の読み込みより先に変更の通知が来たら、通知の方が新しいため、読み込みの結果（成功・失敗とも）は渡さない。
 * 読み込みの途中で購読をやめたときも渡さない
 */
export function watchStoredLogCount(
  item: StorageItem<StoredLogEntry[]>,
  listener: (state: StoredLogCount) => void,
): () => void {
  /** 読み込みの結果を listener に渡すか。変更の通知が来たら、または購読をやめたら渡さない */
  let shouldPassLoaded = true;
  const unwatch = item.watch((logs) => {
    shouldPassLoaded = false;
    listener(isStoredLogs(logs) ? { status: "loaded", count: logs.length } : { status: "failed" });
  });
  async function load(): Promise<void> {
    try {
      const logs = await readStoredLogs(item);
      if (shouldPassLoaded) {
        listener({ status: "loaded", count: logs.length });
      }
    } catch (error) {
      console.error("保存されたログの件数を読み込めませんでした", error);
      if (shouldPassLoaded) {
        listener({ status: "failed" });
      }
    }
  }
  void load();
  return () => {
    shouldPassLoaded = false;
    unwatch();
  };
}

/**
 * 件数の状態から、「ログを消去」を押せるかを決める。
 * 読み込み中は押せない。0 件でも、エラーの直前の文脈として background のメモリに溜めたログを消せるよう押せる。
 * 読み込みに失敗したときは、壊れた保存データを消して戻せるよう押せる
 */
export function canClearLogs(count: StoredLogCount): boolean {
  switch (count.status) {
    case "loading": {
      return false;
    }
    case "loaded":
    case "failed": {
      return true;
    }
    default: {
      return count satisfies never;
    }
  }
}
