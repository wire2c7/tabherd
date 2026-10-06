import { browser } from "wxt/browser";

import { logListenerErrors } from "../../utils/logging/listener";
import type { LogsResponse } from "../../utils/logging/messages";
import { isLogsRequest } from "../../utils/logging/messages";
import type { StoredLogs } from "../../utils/logging/setup";
import { getAppLogger } from "../../utils/logging/setup";

const logger = getAppLogger("background");

/**
 * 拡張機能のコードが捕捉しなかったエラーをログに残す。Service Worker の最初の評価の中で登録する必要がある。
 * chrome.* のイベントのリスナーが同期的に投げた例外はここに届かないため、リスナーを logListenerErrors で包む
 */
export function logUncaughtErrors(): void {
  globalThis.addEventListener("error", (event: ErrorEvent) => {
    // error は投げられた値そのもので、Error 以外の値や null のこともあるため、場所とメッセージも残す。
    // filename は拡張機能自身のスクリプトの URL で、閲覧先の URL ではない
    logger.error("捕捉されないエラーが起きました", {
      error: event.error,
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    logger.error("捕捉されない Promise の拒否が起きました", { error: event.reason });
  });
}

/**
 * オプションページからのログについての依頼（消去・保存の待ち）を受ける。
 * 端末への書き込みを background だけで行い、保存と消去を受け取った順に処理するため、オプションページは直接消さずに依頼する。
 * 書き出しの前には、保存の途中のログが書き出したファイルから漏れないよう、保存が終わるのを待ってもらう
 */
export function handleLogsRequests(storedLogs: StoredLogs): void {
  browser.runtime.onMessage.addListener(
    // oxlint-disable-next-line typescript/strict-void-return -- WXT の型は void だが、Chrome は true を返したリスナーの非同期の sendResponse を待つ
    logListenerErrors(logger, (message: unknown, sender, sendResponse: (response: LogsResponse) => void) => {
      const request = sender.id === browser.runtime.id && isLogsRequest(message) ? message : null;
      if (request !== null) {
        void (async () => {
          try {
            await (request.type === "clear-logs" ? storedLogs.clear() : storedLogs.settled());
            sendResponse({ ok: true });
          } catch (error) {
            // sendResponse は、経路が切れた後（オプションページを閉じた等）や2回目に呼んでも、例外を投げずに何もしない
            // （Chromium の extensions/renderer/api/messaging/one_time_message_handler.cc の OnOneTimeMessageResponse）。
            // そのため、ここに来るのは消去・待ちが失敗したときだけで、返事を送る処理の例外が捕捉されない拒否になることはない
            sendResponse({ ok: false, error: String(error) });
          }
        })();
      }
      // 返事を非同期で送るときは、true を返してメッセージの経路を開けておく（Promise を返す方法は Chrome 148 からで、段階的に提供中）。
      // ほかのメッセージには返事をしない
      return request !== null;
    }),
  );
}
