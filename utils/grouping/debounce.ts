/** 値がまとまって変わる1つの区間の、最初の変更前の値と最後の変更後の値 */
export interface DebouncedChange<T> {
  oldValue: T;
  newValue: T;
}

/**
 * 値の変更を、最後の変更から ms のあいだ次の変更がなければ1つの区間としてまとめる関数を作る。
 *
 * @param ms - まとめる間隔（ミリ秒）
 * @returns 値が変わるたびに呼ぶ関数。新しい区間の最初の変更なら、その区間が確定するまで待つ Promise を返す。
 * 保留中の区間の途中の変更なら undefined を返す（区間の Promise は最初の呼び出しが持っている）
 * @remarks 呼び出し側は、区間の最初の変更があった時点で返ってきた Promise を使って処理を進める。
 * Promise が解決するタイミングを待つのはこの呼び出し側自身の役目で、区間の途中で呼び出し側の処理が
 * 詰まっていても、次の区間は呼ばれるたびに正しく始まる（保留中かどうかは setTimeout 自身の状態で判定するため）
 */
export function debounceChanges<T>(ms: number): (newValue: T, oldValue: T) => Promise<DebouncedChange<T>> | undefined {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let periodOldValue: { value: T } | undefined;
  let latestNewValue: { value: T } | undefined;
  let settling: PromiseWithResolvers<DebouncedChange<T>> | undefined;

  // oxlint-disable-next-line typescript/promise-function-async -- 新しい区間かどうかで、同期的に undefined か Promise かを返し分けるため
  return (newValue, oldValue) => {
    const isNewPeriod = timer === undefined;
    periodOldValue ??= { value: oldValue };
    latestNewValue = { value: newValue };
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { value: resolvedOldValue } = periodOldValue ?? { value: oldValue };
      const { value: resolvedNewValue } = latestNewValue ?? { value: newValue };
      periodOldValue = undefined;
      latestNewValue = undefined;
      timer = undefined;
      const resolved = settling;
      settling = undefined;
      resolved?.resolve({ oldValue: resolvedOldValue, newValue: resolvedNewValue });
    }, ms);
    if (!isNewPeriod) {
      return;
    }
    settling = Promise.withResolvers();
    // oxlint-disable-next-line typescript/consistent-return -- 新しい区間なら確定待ちのPromiseを、そうでなければ何も返さない
    return settling.promise;
  };
}
