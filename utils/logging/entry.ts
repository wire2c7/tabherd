import type { LogRecord } from "@logtape/logtape";

import type { StoredLogEntry } from "./storage";

/** 循環している参照の代わりに保存する文字列 */
export const CIRCULAR_REFERENCE = "[循環参照]";

/** JSON.stringify がたどっている道筋の上の値。holder は子の値を変換するときの this、source は変換する前の値 */
interface PathEntry {
  holder: object;
  source: object;
}

/**
 * JSON.stringify に渡す変換を作る。
 * - Error は {} になるため、名前・メッセージ・スタックトレースを残す。原因の例外（cause。WXT の storage の MigrationError 等が持つ）と、
 *   AggregateError がまとめた例外（errors）も残す。返したオブジェクトの中の値も同じ変換を通るため、入れ子の Error も同じ形になる
 * - 循環している参照は CIRCULAR_REFERENCE に置き換える。JSON.stringify が例外を投げて値全体が文字列になり、外側のエラーの情報まで失うのを防ぐ。
 *   同じ値を2か所から参照しているだけなら循環ではないため、今たどっている道筋の上にある値だけを見る
 * - BigInt は JSON.stringify が例外を投げるため、10進の文字列にする。値全体が文字列になり、ほかのプロパティを失うのを防ぐ
 */
function createReplacer(): (this: unknown, key: string, value: unknown) => unknown {
  const path: PathEntry[] = [];
  function replace(this: unknown, _key: string, value: unknown): unknown {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (typeof value !== "object" || value === null) {
      return value;
    }
    // this は今の値を持つ親。親より深い値は、もう道筋の上にない
    while (path.length > 0 && path.at(-1)?.holder !== this) {
      path.pop();
    }
    if (path.some((entry) => entry.source === value)) {
      return CIRCULAR_REFERENCE;
    }
    const replaced =
      value instanceof Error
        ? {
            name: value.name,
            message: value.message,
            stack: value.stack,
            // undefined のフィールドは JSON に出ない
            cause: value.cause,
            errors: value instanceof AggregateError ? value.errors : undefined,
          }
        : value;
    path.push({ holder: replaced, source: value });
    return replaced;
  }
  return replace;
}

/** 文字列にもできない値の代わりに保存する文字列 */
export const UNSERIALIZABLE_VALUE = "[ログに記録できない値]";

/**
 * 値を JSON にできる形に変える。循環している参照は CIRCULAR_REFERENCE に置き換え、それでも変えられない値（読むと例外を投げるプロパティを持つもの等）は文字列にする。
 * 1件の変換の失敗で、一緒に保存するログやエラー本体を失わないよう、例外を投げない
 */
export function toJsonValue(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, createReplacer());
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

/**
 * LogTape のログを、端末に保存する形に変える。
 * バッファが受け取った時点で写すため、多くは保存されずに捨てられる debug のログも、1件ごとに JSON にする。
 * メッセージに埋める値は、メッセージの文字列とプロパティの両方のために2回 JSON にする。
 * どちらもログに渡すのは ID・件数等の小さい値で、件数も判定・操作の数ほどのため、まとめて減らす複雑さに見合わない
 */
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
