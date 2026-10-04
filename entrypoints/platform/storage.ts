import { storage } from "wxt/utils/storage";

import type { StorageItem, StorageItemDefinition } from "../../utils/storage/item";

/** WXT の storage で、定義の値を読み書きする StorageItem を作る */
export function defineStorageItem<T>({ key, fallback }: StorageItemDefinition<T>): StorageItem<T> {
  const item = storage.defineItem<T>(key, { fallback });
  return {
    getValue: async () => item.getValue(),
    setValue: async (value) => item.setValue(value),
    removeValue: async () => item.removeValue(),
    watch: (listener) => item.watch(listener),
  };
}
