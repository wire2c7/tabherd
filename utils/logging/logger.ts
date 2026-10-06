/**
 * 拡張機能のコードが使うロガーの型。ロガーの実装（LogTape）は setup.ts だけが使い、ほかのコードはこれらの型を使う。
 * LogTape の Logger・LogRecord はこれらの型に構造的に代入できる
 */

/** ログのレベル。低い順に並べる */
const LOG_LEVELS = ["trace", "debug", "info", "warning", "error", "fatal"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * ログレベルの高低を比較する。
 *
 * @param a - 比較する一方のログレベル
 * @param b - 比較するもう一方のログレベル
 * @returns a が b より低ければ負、同じなら 0、高ければ正の数
 */
export function compareLogLevel(a: LogLevel, b: LogLevel): number {
  return LOG_LEVELS.indexOf(a) - LOG_LEVELS.indexOf(b);
}

/** ロガー。message の {name} は properties の name の値で埋める */
export interface Logger {
  debug: (message: string, properties?: Record<string, unknown>) => void;
  info: (message: string, properties?: Record<string, unknown>) => void;
  warn: (message: string, properties?: Record<string, unknown>) => void;
  error: (message: string, properties?: Record<string, unknown>) => void;
}

/** ロガーから sink へ渡るログの1件 */
export interface LogEvent {
  /** カテゴリの階層（例: ["tabherd", "grouping"]） */
  readonly category: readonly string[];
  readonly level: LogLevel;
  /** メッセージ。文字列と埋める値が交互に並ぶ（偶数番目が文字列） */
  readonly message: readonly unknown[];
  /** ミリ秒の Unix 時間 */
  readonly timestamp: number;
  readonly properties: Record<string, unknown>;
}
