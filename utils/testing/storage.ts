import type { StorageItem, StorageItemDefinition } from "../storage/item";

/** テスト用の、メモリに値を持つ StorageItem */
export interface MemoryStorageItem<T> extends StorageItem<T> {
  /** 保存されている値の写し。保存されていなければ undefined か null */
  readonly stored: unknown;
  /** 形を確かめずに値を保存し、watch に通知する。壊れた値や、ほかの画面からの書き込みの代わりに使う */
  store: (value: unknown) => void;
}

/** chrome.storage の読み書きと同じく、呼び出しより後に読み書きするため、次のマイクロタスクまで待つ */
async function tick(): Promise<void> {
  await Promise.resolve();
}

/** chrome.storage と同じく、保存・読み込みのたびに値を写す（読んだ値を書き換えても保存値は変わらない） */
function copy(value: unknown): unknown {
  return value === undefined ? undefined : structuredClone(value);
}

/**
 * 保存値が同じか。保存値は JSON にできる値に限るため、JSON で比べる（WXT の watch は dequal で比べる）。
 * JSON.stringify はオブジェクトのキーの並び順を区別するため、並び順だけが違う値は dequal と違って別の値として通知する。
 * テストでルール・タイトルの一覧をキーの並び順を変えて保存することは無いため、今は問題にならない
 */
function isSame(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * 定義の fallback を使う、メモリに値を持つ StorageItem を作る。WXT の storage と同じく、
 * - 保存されていないときは、読む値も watch に渡す値も fallback にする
 * - 値が変わらない書き込み（保存されていない値の削除を含む）は通知しない
 * - 通知は書き込みの Promise が解決する前に届く（Chromium で、onChanged が set の解決より先に届くことを確かめた）
 */
export function createMemoryStorageItem<T>({
  fallback,
}: Pick<StorageItemDefinition<T>, "fallback">): MemoryStorageItem<T> {
  let stored: unknown;
  const listeners = new Set<(newValue: unknown, oldValue: unknown) => void>();

  function store(value: unknown): void {
    const oldValue = stored;
    stored = copy(value);
    if (isSame(oldValue, stored)) {
      return;
    }
    for (const listener of listeners) {
      listener(copy(stored) ?? fallback, copy(oldValue) ?? fallback);
    }
  }

  return {
    get stored(): unknown {
      return copy(stored);
    },
    store,
    getValue: async () => {
      await tick();
      return copy(stored) ?? fallback;
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
