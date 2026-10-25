import type { StoredLogEntry } from "../../utils/logging/storage";
import { isStoredLogs, readStoredLogs } from "../../utils/logging/storage";
import type { StorageItem } from "../../utils/storage/item";
import { watchAndLoad } from "../watch-and-load";

/** 端末に保存したログの件数の状態 */
export type StoredLogCount =
  | { status: "loading" }
  | { status: "loaded"; count: number }
  /** 読み込みに失敗したか、保存した値が壊れている（配列でない） */
  | { status: "failed" };

/**
 * LOGS_ITEM の StorageItem に保存したログの件数の状態を、読み込んだときと変わったときに listener へ渡す。
 *
 * @param item - 読む元の StorageItem
 * @param listener - 件数の状態を受け取るリスナー
 * @returns 購読をやめる関数
 * @remarks 最初の読み込みより先に変更の通知が来たら、通知の方が新しいため、読み込みの結果（成功・失敗とも）は渡さない。読み込みの途中で購読をやめたときも渡さない
 */
export function watchStoredLogCount(
  item: StorageItem<StoredLogEntry[]>,
  listener: (state: StoredLogCount) => void,
): () => void {
  return watchAndLoad<StoredLogCount>({
    watch: (onValue) =>
      item.watch((logs) => {
        onValue(isStoredLogs(logs) ? { status: "loaded", count: logs.length } : { status: "failed" });
      }),
    read: async () => {
      const logs = await readStoredLogs(item);
      return { status: "loaded", count: logs.length };
    },
    onChange: listener,
    onLoadFailed: (error) => {
      console.error("保存されたログの件数を読み込めませんでした", error);
      listener({ status: "failed" });
    },
  });
}

/**
 * 件数の状態から、「ログを消去」を押せるかを決める。
 *
 * @param count - 判定する件数の状態
 * @returns 押せれば true
 * @remarks 読み込み中は押せない。0 件でも、エラーの直前の文脈として background のメモリに溜めたログを消せるよう押せる。読み込みに失敗したときは、壊れた保存データを消して戻せるよう押せる
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
