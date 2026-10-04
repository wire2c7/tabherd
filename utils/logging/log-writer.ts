import type { StorageItem } from "../storage/item";
import type { StoredLogEntry } from "./storage";
import { appendLogs } from "./storage";

/** 端末へのログの書き込み */
export interface LogWriter {
  /** ログを末尾に保存する。保存は待ち行列で順に行う */
  write: (entry: StoredLogEntry) => void;
  /** それまでに受け取ったログを消す。それまでの保存が終わってから消し、消し終わると解決する */
  clear: () => Promise<void>;
  /** それまでに受け取った保存・消去が終わると解決する */
  settled: () => Promise<void>;
}

/** 端末への書き込みの1件 */
type WriteJob = { type: "append"; entries: StoredLogEntry[] } | { type: "clear"; done: PromiseWithResolvers<null> };

async function runJob(item: StorageItem<StoredLogEntry[]>, job: WriteJob): Promise<void> {
  if (job.type === "append") {
    try {
      await appendLogs(item, job.entries);
    } catch (error) {
      // ロガーに出すとこの書き込みに戻るため、console に出す
      console.error("ログを端末に書き込めませんでした", error);
    }
    return;
  }
  try {
    await item.removeValue();
    job.done.resolve(null);
  } catch (error) {
    job.done.reject(error);
  }
}

/**
 * 受け取ったログを、LOGS_ITEM の StorageItem に保存する書き込み口を作る。
 * chrome.storage には条件付きの書き込みが無く、追記は「読む → 足す → 書く」になるため、追記と消去を1本の待ち行列で受け取った順に1つずつ行う。
 * write は同期で呼ばれるため、まだ始めていない追記が待ち行列の末尾にあれば、そこへまとめる
 */
export function getLogWriter(item: StorageItem<StoredLogEntry[]>): LogWriter {
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
        await runJob(item, job);
      }
      isDraining = false;
    })();
  }

  function write(entry: StoredLogEntry): void {
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

  return { write, clear, settled: async () => draining };
}
