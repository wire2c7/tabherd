/**
 * 値の変更を、最後の変更から ms のあいだ次の変更がなければまとめて通知する。
 *
 * @param ms - まとめる間隔（ミリ秒）
 * @param listener - まとめた変更を受け取るリスナー
 * @returns 変更のたびに呼ぶ関数
 * @remarks listener には、まとめた変更のうち最初の変更前の値と、最後の変更後の値を渡す
 */
export function debounceChanges<T>(
  ms: number,
  listener: (newValue: T, oldValue: T) => void,
): (newValue: T, oldValue: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstOldValue: { value: T } | undefined;
  return (newValue, oldValue) => {
    firstOldValue ??= { value: oldValue };
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { value } = firstOldValue ?? { value: oldValue };
      firstOldValue = undefined;
      listener(newValue, value);
    }, ms);
  };
}
