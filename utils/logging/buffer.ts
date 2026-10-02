import type { LogLevel, LogRecord, Sink } from "@logtape/logtape";
import { compareLogLevel } from "@logtape/logtape";

export interface BufferUntilOptions {
  /** このレベル以上のログが来たら、溜めたログと一緒に流す */
  triggerLevel: LogLevel;
  /** 溜めるログの件数の上限。超えた分は古いものから捨てる */
  maxBufferSize: number;
}

/**
 * triggerLevel より下のログを溜め、triggerLevel 以上のログが来たら、溜めたログとそのログを sink へ流して空にする。
 * LogTape の fingersCrossed と違い、流した後は元の状態に戻り、次の triggerLevel 以上のログまで流さない
 */
export function bufferUntil(sink: Sink, { triggerLevel, maxBufferSize }: BufferUntilOptions): Sink {
  const buffer: LogRecord[] = [];
  return (record) => {
    if (compareLogLevel(record.level, triggerLevel) < 0) {
      buffer.push(record);
      if (buffer.length > maxBufferSize) {
        buffer.shift();
      }
      return;
    }
    for (const buffered of buffer.splice(0)) {
      sink(buffered);
    }
    sink(record);
  };
}
