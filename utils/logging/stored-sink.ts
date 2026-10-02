import type { LogRecord, Sink } from "@logtape/logtape";

import { toStoredLogEntry } from "./entry";
import type { StoredLogEntry } from "./storage";
import { appendLogs } from "./storage";

/** 端末にログを保存する sink */
export interface StoredLogSink extends Sink {
  /** それまでに受け取ったログの保存が終わると解決する */
  settled: () => Promise<void>;
}

/**
 * 受け取ったログを端末に保存する sink を作る。
 * sink は同期で呼ばれるため、ログを溜めておき、前の書き込みが終わってからまとめて追記する
 */
export function getStoredLogSink(): StoredLogSink {
  let pending: StoredLogEntry[] = [];
  let tail: Promise<void> = Promise.resolve();

  function sink(record: LogRecord): void {
    // 呼び出し側が後で値を変えても保存する内容が変わらないよう、受け取った時点で変える
    pending.push(toStoredLogEntry(record));
    if (pending.length > 1) {
      // 先に予約した書き込みがまとめて保存する
      return;
    }
    tail = (async () => {
      await tail;
      const entries = pending;
      pending = [];
      try {
        await appendLogs(entries);
      } catch (error) {
        // ロガーに出すとこの sink に戻るため、console に出す
        console.error("ログを保存できませんでした", error);
      }
    })();
  }

  return Object.assign(sink, { settled: async () => tail });
}
