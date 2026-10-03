import { logsItem } from "../../utils/logging/storage";

/**
 * 端末に保存したログの件数を、読み込んだときと変わったときに listener へ渡す。戻り値は購読をやめる関数。
 * 最初の読み込みより先に変更の通知が来たら、通知の方が新しいため、読み込みの結果は渡さない
 */
export function watchStoredLogCount(listener: (count: number) => void): () => void {
  let isNotified = false;
  const unwatch = logsItem.watch((logs) => {
    isNotified = true;
    listener(logs.length);
  });
  async function load(): Promise<void> {
    const logs = await logsItem.getValue();
    if (!isNotified) {
      listener(logs.length);
    }
  }
  void load();
  return unwatch;
}
