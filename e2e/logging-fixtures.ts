import type { StoredLogEntry } from "../utils/logging/storage";
import { test as base } from "./fixtures";

export { expect, rule } from "./fixtures";

interface LoggingFixtures {
  /** 端末に保存したログをストレージに書く。オプションページの件数の表示に通知される */
  setLogs: (logs: readonly StoredLogEntry[]) => Promise<void>;
  /** 端末に保存したログ（古い順） */
  storedLogs: () => Promise<StoredLogEntry[]>;
}

/** ログの E2E テスト用に、端末に保存したログの読み書きを足した test */
export const test = base.extend<LoggingFixtures>({
  setLogs: async ({ serviceWorker }, provide) => {
    await provide(async (logs) => {
      // WXT の storage の `local:logs` は、chrome.storage.local の `logs` に保存される
      await serviceWorker.evaluate(async (value) => chrome.storage.local.set({ logs: value }), logs);
    });
  },
  storedLogs: async ({ serviceWorker }, provide) => {
    await provide(async () =>
      serviceWorker.evaluate(async () => {
        const { logs } = await chrome.storage.local.get<{ logs?: StoredLogEntry[] }>("logs");
        return logs ?? [];
      }),
    );
  },
});
