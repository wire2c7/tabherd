import type { LogLevel, LogRecord, Sink } from "@logtape/logtape";
import { compareLogLevel } from "@logtape/logtape";

import { toStoredLogEntry } from "./entry";
import type { StoredLogEntry } from "./storage";

export interface BufferUntilOptions {
  /** このレベル以上のログが来たら、溜めたログと一緒に流す */
  triggerLevel: LogLevel;
  /** 溜めるログの件数の上限。超えた分は古いものから捨てる */
  maxBufferSize: number;
}

/** ログを溜める sink */
export interface BufferingSink extends Sink {
  /** 溜めたログを流さずに捨てる */
  clear: () => void;
}

/**
 * triggerLevel より下のログを溜め、triggerLevel 以上のログが来たら、溜めたログとそのログを write へ流して空にする。
 * LogTape の fingersCrossed と違い、流した後は元の状態に戻り、次の triggerLevel 以上のログまで流さない。
 * LogTape はログに渡された値を一段しか写さないため、呼び出し側が後で配列・オブジェクトを書き換えても溜めた内容が変わらないよう、
 * 受け取った時点で保存する形（JSON の写し）に変えて溜める
 */
export function bufferUntil(
  write: (entry: StoredLogEntry) => void,
  { triggerLevel, maxBufferSize }: BufferUntilOptions,
): BufferingSink {
  const buffer: StoredLogEntry[] = [];
  function bufferingSink(record: LogRecord): void {
    const entry = toStoredLogEntry(record);
    if (compareLogLevel(record.level, triggerLevel) < 0) {
      buffer.push(entry);
      if (buffer.length > maxBufferSize) {
        buffer.shift();
      }
      return;
    }
    for (const buffered of buffer.splice(0)) {
      write(buffered);
    }
    write(entry);
  }
  return Object.assign(bufferingSink, {
    clear: () => {
      buffer.length = 0;
    },
  });
}
