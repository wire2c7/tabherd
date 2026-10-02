import type { LogLevel } from "@logtape/logtape";
import { storage } from "wxt/utils/storage";

/** 端末に保存する1件のログ */
export interface StoredLogEntry {
  /** ISO 8601 の日時 */
  timestamp: string;
  level: LogLevel;
  /** カテゴリを「.」でつないだもの（例: tabherd.grouping） */
  category: string;
  /** テンプレートに値を埋めたメッセージ */
  message: string;
  /** JSON にできる形に変えたプロパティ */
  properties: Record<string, unknown>;
}

/** 端末に保存するログの件数の上限。超えた分は古いものから捨てる */
export const MAX_STORED_LOGS = 500;

/** 端末に保存したログ。古い順に並ぶ。データの形を変えるときは version を上げて migrations を書く */
export const logsItem = storage.defineItem<StoredLogEntry[]>("local:logs", {
  fallback: [],
  version: 1,
});

/** 保存したログの末尾に entries を足し、直近の MAX_STORED_LOGS 件に切る */
export async function appendLogs(entries: readonly StoredLogEntry[]): Promise<void> {
  const logs = await logsItem.getValue();
  await logsItem.setValue([...logs, ...entries].slice(-MAX_STORED_LOGS));
}
