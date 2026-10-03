import type { LogRecord } from "@logtape/logtape";

import type { StoredLogEntry } from "./storage";

/** JSON.stringify では Error が {} になるため、名前・メッセージ・スタックトレースを残す */
function replaceError(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/** 文字列にもできない値の代わりに保存する文字列 */
export const UNSERIALIZABLE_VALUE = "[ログに記録できない値]";

/**
 * 値を JSON にできる形に変える。変えられない値（循環する参照等）は文字列にする。
 * 1件の変換の失敗で、一緒に保存するログやエラー本体を失わないよう、例外を投げない
 */
export function toJsonValue(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, replaceError);
    // undefined・関数は JSON.stringify が undefined を返す
    return json === undefined ? null : JSON.parse(json);
  } catch {
    try {
      return String(value);
    } catch {
      // プロトタイプの無いオブジェクト等は String でも例外を投げる
      return UNSERIALIZABLE_VALUE;
    }
  }
}

/** メッセージに埋める値を文字列にする */
function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  return JSON.stringify(toJsonValue(value));
}

/** LogTape のログを、端末に保存する形に変える */
export function toStoredLogEntry(record: LogRecord): StoredLogEntry {
  return {
    timestamp: new Date(record.timestamp).toISOString(),
    level: record.level,
    category: record.category.join("."),
    // message は文字列と埋める値が交互に並ぶ（偶数番目が文字列）
    message: record.message.map((part, index) => (index % 2 === 0 ? String(part) : formatValue(part))).join(""),
    properties: Object.fromEntries(Object.entries(record.properties).map(([key, value]) => [key, toJsonValue(value)])),
  };
}
