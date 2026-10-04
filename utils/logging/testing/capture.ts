import type { LogRecord } from "@logtape/logtape";
import { configureSync, resetSync } from "@logtape/logtape";
import { onTestFinished } from "vitest";

/**
 * テストの中で拡張機能のログを受け取る。戻り値の records に、受け取った順に入る。
 * テストが失敗しても後のテストへ設定が残らないよう、テストの終わりに設定を戻す
 */
export function captureLogs(): LogRecord[] {
  const records: LogRecord[] = [];
  onTestFinished(() => {
    resetSync();
  });
  configureSync({
    reset: true,
    sinks: {
      capture: (record) => {
        records.push(record);
      },
    },
    loggers: [
      { category: ["tabherd"], lowestLevel: "debug", sinks: ["capture"] },
      { category: ["logtape", "meta"], lowestLevel: null },
    ],
  });
  return records;
}
