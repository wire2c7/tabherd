import type { Logger } from "@logtape/logtape";
import { configureSync, getConsoleSink, getLogger, withFilter } from "@logtape/logtape";

import { bufferUntil } from "./buffer";
import { getStoredLogSink } from "./stored-sink";

/** 拡張機能のログのカテゴリの先頭 */
const ROOT_CATEGORY = "tabherd";

/** 端末に保存するきっかけのレベル */
const STORE_TRIGGER_LEVEL = "warning";

/** 端末に保存するきっかけのログの前に、一緒に保存するログの件数 */
const CONTEXT_LOG_COUNT = 50;

export interface ConfigureLoggingOptions {
  /** 開発ビルドなら debug 以上、そうでなければ warning 以上を console に出す */
  dev: boolean;
}

/**
 * ロガーを設定する。設定より前に出したログは捨てられるため、起動時に同期的に呼ぶ。
 * 戻り値は、それまでに端末へ保存すると決まったログの保存が終わると解決する関数
 */
export function configureLogging({ dev }: ConfigureLoggingOptions): () => Promise<void> {
  const stored = getStoredLogSink();
  configureSync({
    sinks: {
      console: withFilter(getConsoleSink(), dev ? "debug" : "warning"),
      stored: bufferUntil(stored, { triggerLevel: STORE_TRIGGER_LEVEL, maxBufferSize: CONTEXT_LOG_COUNT }),
    },
    loggers: [
      { category: [ROOT_CATEGORY], lowestLevel: "debug", sinks: ["console", "stored"] },
      // LogTape 自身の設定の警告等
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
  return stored.settled;
}

/**
 * 拡張機能の領域（background・grouping 等）のロガーを返す。
 * ログには ID・件数・処理の種類・エラーだけを渡し、URL・タイトル・グループ名・ルールの内容は渡さない（端末に保存され、書き出して公開されるため）
 */
export function getAppLogger(area: string): Logger {
  return getLogger([ROOT_CATEGORY, area]);
}
