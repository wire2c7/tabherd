import { storage } from "wxt/utils/storage";

import type { StorageItem, StorageItemDefinition } from "../../utils/storage/item";

/**
 * WXT の storage で、定義の値を読み書きする StorageItem を作る。
 *
 * @param definition - 保存先のキーと、保存されていないときの値
 * @returns 作った StorageItem
 * @remarks WXT の item をそのまま返さず包むのは、StorageItem に無いメソッド（getMeta 等）を utils/・components/ から使えないようにするため
 */
export function defineStorageItem<T>({ key, fallback }: StorageItemDefinition<T>): StorageItem<T> {
  const item = storage.defineItem<T>(key, { fallback });
  return {
    getValue: async () => item.getValue(),
    setValue: async (value) => item.setValue(value),
    removeValue: async () => item.removeValue(),
    watch: (listener) => item.watch(listener),
  };
}
