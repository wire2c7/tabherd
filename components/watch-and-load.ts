/** watchAndLoad が受け取る、値の購読・読み込み・結果の受け取り先 */
export interface WatchAndLoadOptions<T> {
  /** 値の変更を購読する。購読を解除する関数を返す */
  watch: (listener: (value: T) => void) => () => void;
  /** 値を読み込む */
  read: () => Promise<T>;
  /** 読み込んだ・変わった値を受け取る */
  onChange: (value: T) => void;
  /** 読み込みが失敗したことを受け取る */
  onLoadFailed: (error: unknown) => void;
}

/**
 * watch で値の変更を購読しつつ、最初の値を read で読み込む。
 *
 * @param options - 値の購読・読み込み・結果の受け取り先
 * @returns 購読をやめる関数
 * @remarks 読み込みより先に watch で値を受け取っていれば、そちらが新しいため読み込みの結果（成功・失敗とも）は無視する。
 * 購読をやめた後に読み込み・変更が届いても、onChange・onLoadFailed は呼ばない
 */
export function watchAndLoad<T>({ watch, read, onChange, onLoadFailed }: WatchAndLoadOptions<T>): () => void {
  let receivedFromWatch = false;
  let stopped = false;
  const unwatch = watch((value) => {
    receivedFromWatch = true;
    if (!stopped) {
      onChange(value);
    }
  });
  void (async () => {
    try {
      const value = await read();
      if (!receivedFromWatch && !stopped) {
        onChange(value);
      }
    } catch (error) {
      if (!receivedFromWatch && !stopped) {
        onLoadFailed(error);
      }
    }
  })();
  return () => {
    stopped = true;
    unwatch();
  };
}
