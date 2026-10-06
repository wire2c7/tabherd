import { getAppLogger } from "../logging/setup";

const logger = getAppLogger("grouping");

/**
 * 渡された処理を1つずつ順に実行するキューを作る。
 *
 * @returns 処理を積む関数。戻り値は、その処理が終わると解決する Promise
 */
export function createSerialQueue(): (task: () => Promise<void>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve();
  return async (task) => {
    const previous = tail;
    tail = (async () => {
      await previous;
      try {
        await task();
      } catch (error) {
        // 1回の失敗で以降の処理を止めない
        logger.error("グループの処理に失敗しました", { error });
      }
    })();
    return tail;
  };
}
