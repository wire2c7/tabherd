import type { LogRecord } from "@logtape/logtape";
import { configureSync } from "@logtape/logtape";

/** テストの中で拡張機能のログを受け取る。戻り値の records に、受け取った順に入る。テストの後に resetSync で設定を戻す */
export function captureLogs(): LogRecord[] {
  const records: LogRecord[] = [];
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
