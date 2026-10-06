import { toStoredLogEntry } from "./entry";
import type { LogEvent, LogLevel } from "./logger";
import { compareLogLevel } from "./logger";
import type { StoredLogEntry } from "./storage";

export interface BufferUntilOptions {
  /** このレベル以上のログが来たら、溜めたログと一緒に流す */
  triggerLevel: LogLevel;
  /** 溜めるログの件数の上限。超えた分は古いものから捨てる */
  maxBufferSize: number;
}

/** ログを溜める sink */
export interface BufferingSink {
  (record: LogEvent): void;
  /**
   * 溜めたログを流さずに捨て、捨てたログを溜め直す関数を返す。
   * 溜め直す関数は、捨てた後にログを流したか、別の消去で捨てていたら何もしない。
   * 流していたら、流したログより古いログが後から流れて保存の順序が崩れる。別の消去の後なら、その消去より前のログが戻ってしまう
   */
  clear: () => () => void;
}

/**
 * triggerLevel より下のログを溜め、triggerLevel 以上のログが来たら、溜めたログとそのログを write へ流して空にする。
 *
 * @param write - 溜めたログ・流すログを渡す書き込み先
 * @param options - 流すきっかけのレベルと、溜める件数の上限
 * @returns ログを受け取る sink。溜めたログを捨てる clear も持つ
 * @remarks
 * LogTape の fingersCrossed と違い、流した後は元の状態に戻り、次の triggerLevel 以上のログまで流さない。
 * LogTape はログに渡された値を一段しか写さないため、呼び出し側が後で配列・オブジェクトを書き換えても溜めた内容が変わらないよう、
 * 受け取った時点で保存する形（JSON の写し）に変えて溜める
 */
export function bufferUntil(
  write: (entry: StoredLogEntry) => void,
  { triggerLevel, maxBufferSize }: BufferUntilOptions,
): BufferingSink {
  const buffer: StoredLogEntry[] = [];
  /** ログを流すか捨てるたびに増やす。捨てたログを溜め直す前に、捨てた後に流したか捨てたかを見分ける */
  let generation = 0;
  function bufferingSink(record: LogEvent): void {
    const entry = toStoredLogEntry(record);
    if (compareLogLevel(record.level, triggerLevel) < 0) {
      buffer.push(entry);
      if (buffer.length > maxBufferSize) {
        buffer.shift();
      }
      return;
    }
    generation += 1;
    for (const buffered of buffer.splice(0)) {
      write(buffered);
    }
    write(entry);
  }
  return Object.assign(bufferingSink, {
    clear: () => {
      const discarded = buffer.splice(0);
      generation += 1;
      const generationAtClear = generation;
      return () => {
        if (generation !== generationAtClear) {
          return;
        }
        // 捨てた後に溜めたログより前に戻し、上限を超えた分は古いものから捨てる
        buffer.unshift(...discarded);
        buffer.splice(0, Math.max(0, buffer.length - maxBufferSize));
      };
    },
  });
}
