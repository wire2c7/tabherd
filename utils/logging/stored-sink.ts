import type { LogRecord, Sink } from "@logtape/logtape";

import { toStoredLogEntry } from "./entry";
import type { StoredLogEntry } from "./storage";
import { appendLogs, logsItem } from "./storage";

/** 端末にログを保存する sink */
export interface StoredLogSink extends Sink {
  /** それまでに受け取ったログを消す。それまでの保存が終わってから消し、消し終わると解決する */
  clear: () => Promise<void>;
  /** それまでに受け取った保存・消去が終わると解決する */
  settled: () => Promise<void>;
}

/** 端末への書き込みの1件 */
type WriteJob = { type: "append"; entries: StoredLogEntry[] } | { type: "clear"; done: PromiseWithResolvers<null> };

async function runJob(job: WriteJob): Promise<void> {
  if (job.type === "append") {
    try {
      await appendLogs(job.entries);
    } catch (error) {
      // ロガーに出すとこの sink に戻るため、console に出す
      console.error("ログを保存できませんでした", error);
    }
    return;
  }
  try {
    await logsItem.removeValue();
    job.done.resolve(null);
  } catch (error) {
    job.done.reject(error);
  }
}

/**
 * 受け取ったログを端末に保存する sink を作る。
 * chrome.storage には条件付きの書き込みが無く、追記は「読む → 足す → 書く」になるため、追記と消去を1本の待ち行列で受け取った順に1つずつ行う。
 * sink は同期で呼ばれるため、まだ始めていない追記が待ち行列の末尾にあれば、そこへまとめる
 */
export function getStoredLogSink(): StoredLogSink {
  const queue: WriteJob[] = [];
  let draining: Promise<void> = Promise.resolve();
  let isDraining = false;

  function startDraining(): void {
    if (isDraining) {
      return;
    }
    isDraining = true;
    draining = (async () => {
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
        // 前の書き込みが終わってから次を始める
        // oxlint-disable-next-line no-await-in-loop
        await runJob(job);
      }
      isDraining = false;
    })();
  }

  function sink(record: LogRecord): void {
    // 呼び出し側が後で値を変えても保存する内容が変わらないよう、受け取った時点で変える
    const entry = toStoredLogEntry(record);
    const last = queue.at(-1);
    // 待ち行列に残っている追記はまだ始めていないため、まとめても順序は変わらない。消去を挟んだら別の追記にする
    if (last?.type === "append") {
      last.entries.push(entry);
    } else {
      queue.push({ type: "append", entries: [entry] });
    }
    startDraining();
  }

  async function clear(): Promise<void> {
    const done = Promise.withResolvers<null>();
    queue.push({ type: "clear", done });
    startDraining();
    await done.promise;
  }

  return Object.assign(sink, { clear, settled: async () => draining });
}
