import type { Logger } from "@logtape/logtape";

/**
 * イベントのリスナーを包み、リスナーが同期的に投げた例外をログに残してから投げ直す。
 * Chrome は chrome.* のイベントのリスナーが投げた例外を自分で受け取るため、Service Worker の error イベントに届かない。
 * 投げ直すのは、Chrome での例外の扱い（拡張機能のエラーの一覧への表示等）を変えないため
 */
export function logListenerErrors<Args extends unknown[], Result>(
  logger: Logger,
  listener: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args) => {
    try {
      return listener(...args);
    } catch (error) {
      logger.error("イベントの処理で捕捉されないエラーが起きました", { error });
      throw error;
    }
  };
}
