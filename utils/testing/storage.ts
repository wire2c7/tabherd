import type { StorageItem, StorageItemDefinition } from "../storage/item";

/** テスト用の、メモリに値を持つ StorageItem */
export interface MemoryStorageItem<T> extends StorageItem<T> {
  /** 保存されている値。保存されていなければ undefined か null */
  readonly stored: unknown;
  /** 形を確かめずに値を保存し、watch に通知する。壊れた値や、ほかの画面からの書き込みの代わりに使う */
  store: (value: unknown) => void;
}

/** chrome.storage の読み書きと同じく、呼び出しより後に読み書きするため、次のマイクロタスクまで待つ */
async function tick(): Promise<void> {
  await Promise.resolve();
}

/**
 * 定義の fallback を使う、メモリに値を持つ StorageItem を作る。
 * WXT の storage と同じく、保存されていないときは読む値も watch に渡す値も fallback にする
 */
export function createMemoryStorageItem<T>({
  fallback,
}: Pick<StorageItemDefinition<T>, "fallback">): MemoryStorageItem<T> {
  let stored: unknown;
  const listeners = new Set<(newValue: unknown, oldValue: unknown) => void>();

  function store(value: unknown): void {
    const oldValue = stored;
    stored = value;
    for (const listener of listeners) {
      listener(value ?? fallback, oldValue ?? fallback);
    }
  }

  return {
    get stored(): unknown {
      return stored;
    },
    store,
    getValue: async () => {
      await tick();
      return stored ?? fallback;
    },
    setValue: async (value) => {
      await tick();
      store(value);
    },
    removeValue: async () => {
      await tick();
      store(null);
    },
    watch: (listener) => {
      // 同じ関数を2回購読しても別の購読として扱う
      function wrapped(newValue: unknown, oldValue: unknown): void {
        listener(newValue, oldValue);
      }
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
  };
}
