import { logsItem } from "../../utils/logging/storage";

/** 端末に保存したログの件数の状態 */
export type StoredLogCount =
  | { status: "loading" }
  | { status: "loaded"; count: number }
  /** 最初の読み込みに失敗し、その後に変更の通知もまだ来ていない */
  | { status: "failed" };

/**
 * 端末に保存したログの件数の状態を、読み込んだときと変わったときに listener へ渡す。戻り値は購読をやめる関数。
 * 最初の読み込みより先に変更の通知が来たら、通知の方が新しいため、読み込みの結果（成功・失敗とも）は渡さない
 */
export function watchStoredLogCount(listener: (state: StoredLogCount) => void): () => void {
  let isNotified = false;
  const unwatch = logsItem.watch((logs) => {
    isNotified = true;
    listener({ status: "loaded", count: logs.length });
  });
  async function load(): Promise<void> {
    try {
      const logs = await logsItem.getValue();
      if (!isNotified) {
        listener({ status: "loaded", count: logs.length });
      }
    } catch (error) {
      console.error("保存されたログの件数を読み込めませんでした", error);
      if (!isNotified) {
        listener({ status: "failed" });
      }
    }
  }
  void load();
  return unwatch;
}

/**
 * 件数の状態から、「ログを消去」を押せるかを決める。
 * 読み込み中と 0 件のときは押せない。読み込みに失敗したときは、壊れた保存データを消して戻せるよう押せる
 */
export function canClearLogs(count: StoredLogCount): boolean {
  switch (count.status) {
    case "loading": {
      return false;
    }
    case "loaded": {
      return count.count > 0;
    }
    case "failed": {
      return true;
    }
    default: {
      return count satisfies never;
    }
  }
}
