/** 保存する値の定義。entrypoints/platform/storage.ts の defineStorageItem が、これから StorageItem を作る */
export interface StorageItemDefinition<T> {
  /** 保存先の領域とキー。session は、ブラウザを閉じるまで残る */
  key: `local:${string}` | `session:${string}`;
  /** 保存されていないときに読む値 */
  fallback: T;
}

/** 保存した1つの値 */
export interface StorageItem<T> {
  /** 保存した値を読む。保存されていなければ fallback。保存した値の形は確かめないため、読む側で確かめる */
  getValue: () => Promise<unknown>;
  setValue: (value: T) => Promise<void>;
  removeValue: () => Promise<void>;
  /** 値の変更を通知する（形は確かめない）。購読を解除する関数を返す */
  watch: (listener: (newValue: unknown, oldValue: unknown) => void) => () => void;
}
