/** debounceChanges が返す、変更の通知と、進行中のデバウンスの確定待ち */
export interface DebouncedChanges<T> {
  /** 値が変わるたびに呼ぶ */
  onChange: (newValue: T, oldValue: T) => void;
  /** 保留中のデバウンスが無ければ即座に、あれば次に確定するまで解決する */
  waitUntilSettled: () => Promise<void>;
}

/**
 * 値の変更を、最後の変更から ms のあいだ次の変更がなければまとめて通知する。
 *
 * @param ms - まとめる間隔（ミリ秒）
 * @param listener - まとめた変更を受け取るリスナー
 * @returns 変更の通知（onChange）と、進行中のデバウンスの確定待ち（waitUntilSettled）
 * @remarks listener には、まとめた変更のうち最初の変更前の値と、最後の変更後の値を渡す
 */
export function debounceChanges<T>(ms: number, listener: (newValue: T, oldValue: T) => void): DebouncedChanges<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstOldValue: { value: T } | undefined;
  let settling: PromiseWithResolvers<null> | undefined;

  function onChange(newValue: T, oldValue: T): void {
    firstOldValue ??= { value: oldValue };
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { value } = firstOldValue ?? { value: oldValue };
      firstOldValue = undefined;
      timer = undefined;
      const resolved = settling;
      settling = undefined;
      try {
        listener(newValue, value);
      } finally {
        resolved?.resolve(null);
      }
    }, ms);
  }

  async function waitUntilSettled(): Promise<void> {
    if (timer === undefined) {
      return;
    }
    settling ??= Promise.withResolvers<null>();
    await settling.promise;
  }

  return { onChange, waitUntilSettled };
}
