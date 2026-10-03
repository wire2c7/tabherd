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

/**
 * 保存した値がログの一覧（配列）か。WXT の storage は保存した値の形を確かめずに返すため、壊れた値はここで見分ける。
 * 中の1件ごとの形までは確かめない
 */
export function isStoredLogs(value: unknown): value is StoredLogEntry[] {
  return Array.isArray(value);
}

/** 保存したログを読む。保存した値が壊れていて配列でなければ、例外を投げる */
export async function readStoredLogs(): Promise<StoredLogEntry[]> {
  const logs: unknown = await logsItem.getValue();
  if (!isStoredLogs(logs)) {
    throw new TypeError(`保存したログが配列ではありません（${typeof logs}）`);
  }
  return logs;
}

/**
 * 保存したログの末尾に entries を足し、直近の MAX_STORED_LOGS 件に切る。
 * 保存した値が壊れていて配列でなければ、読めない値のため捨てて entries だけを保存する。止めると、利用者が消去するまでログを保存できなくなるため
 */
export async function appendLogs(entries: readonly StoredLogEntry[]): Promise<void> {
  const logs: unknown = await logsItem.getValue();
  await logsItem.setValue([...(isStoredLogs(logs) ? logs : []), ...entries].slice(-MAX_STORED_LOGS));
}
