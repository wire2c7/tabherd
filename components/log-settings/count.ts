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
