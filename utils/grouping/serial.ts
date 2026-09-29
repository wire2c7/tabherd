/** 渡された処理を1つずつ順に実行するキュー。戻り値の関数は、その処理が終わると解決する Promise を返す */
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
        console.error("グループの処理に失敗しました", error);
      }
    })();
    return tail;
  };
}
