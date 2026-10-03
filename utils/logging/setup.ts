import type { Logger } from "@logtape/logtape";
import { configureSync, getConsoleSink, getLogger, withFilter } from "@logtape/logtape";

import { bufferUntil } from "./buffer";
import { getLogWriter } from "./log-writer";

/** 拡張機能のログのカテゴリの先頭 */
const ROOT_CATEGORY = "tabherd";

/** 端末に保存するきっかけのレベル */
const STORE_TRIGGER_LEVEL = "warning";

/**
 * 端末に保存するきっかけのログの前に、一緒に保存するログの件数。
 * 複数のウィンドウを同時に処理すると、ほかのウィンドウのログも同じバッファに入るため、1つのウィンドウの判定に要る件数より多めにする
 */
const CONTEXT_LOG_COUNT = 100;

export interface ConfigureLoggingOptions {
  /** 開発ビルドなら debug 以上、そうでなければ warning 以上を console に出す */
  dev: boolean;
}

/** 設定したロガーの、端末に保存したログの操作 */
export interface StoredLogs {
  /**
   * それまでに出たログを、保存済みのものも、エラーの直前の文脈としてメモリに溜めたものも消す。
   * それまでの保存が終わってから消し、消し終わると解決する。後に出たログは消さない。
   * 消せなかったときは、メモリに溜めたログも戻してから拒否する（消している間に警告が出て、溜めたログを保存した後は戻さない）
   */
  clear: () => Promise<void>;
  /** それまでに端末へ保存すると決まったログの保存・消去が終わると解決する */
  settled: () => Promise<void>;
}

/** ロガーを設定する。設定より前に出したログは捨てられるため、起動時に同期的に呼ぶ */
export function configureLogging({ dev }: ConfigureLoggingOptions): StoredLogs {
  const writer = getLogWriter();
  const buffered = bufferUntil(writer.write, { triggerLevel: STORE_TRIGGER_LEVEL, maxBufferSize: CONTEXT_LOG_COUNT });
  configureSync({
    sinks: {
      console: withFilter(getConsoleSink(), dev ? "debug" : "warning"),
      stored: buffered,
    },
    loggers: [
      { category: [ROOT_CATEGORY], lowestLevel: "debug", sinks: ["console", "stored"] },
      // LogTape 自身の設定の警告等
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
  return {
    clear: async () => {
      // 依頼の後に出たログを消さないよう、消し終わるのを待たずに捨てる
      const restore = buffered.clear();
      try {
        await writer.clear();
      } catch (error) {
        restore();
        throw error;
      }
    },
    settled: writer.settled,
  };
}

/**
 * 拡張機能の領域（background・grouping 等）のロガーを返す。
 * ログには ID・件数・処理の種類・エラーだけを渡し、URL・タイトル・グループ名・ルールの内容は渡さない（端末に保存され、書き出して公開されるため）
 */
export function getAppLogger(area: string): Logger {
  return getLogger([ROOT_CATEGORY, area]);
}
