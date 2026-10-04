import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { debounceChanges } from "../utils/grouping/debounce";
import { applyRuleChange, regroupAllWindows, regroupTabs } from "../utils/grouping/regroup";
import { createSerialQueue } from "../utils/grouping/serial";
import { logListenerErrors } from "../utils/logging/listener";
import type { LogsResponse } from "../utils/logging/messages";
import { isLogsRequest } from "../utils/logging/messages";
import type { StoredLogs } from "../utils/logging/setup";
import { configureLogging, getAppLogger } from "../utils/logging/setup";
import { createRulesReader } from "../utils/rules/reader";

/** 設定画面は入力のたびに保存するため、入力途中の名前でグループを作り直し続けないよう待つ時間 */
const RULE_CHANGE_DEBOUNCE_MS = 300;

const logger = getAppLogger("background");

const rulesReader = createRulesReader(logger);

async function regroupAll(): Promise<void> {
  await regroupAllWindows(await rulesReader.read());
}

/**
 * 拡張機能のコードが捕捉しなかったエラーをログに残す。Service Worker の最初の評価の中で登録する必要がある。
 * chrome.* のイベントのリスナーが同期的に投げた例外はここに届かないため、リスナーを logListenerErrors で包む
 */
function logUncaughtErrors(): void {
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
function handleLogsRequests(storedLogs: StoredLogs): void {
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

export default defineBackground(() => {
  const storedLogs = configureLogging({ dev: import.meta.env.DEV });
  logUncaughtErrors();
  handleLogsRequests(storedLogs);

  // グループを作ってからタイトルを付けるまでに別のイベントを処理すると同名のグループが2つできるため、処理を直列にする。
  // 各処理は開始時にルールとスナップショットを読み直す
  const enqueue = createSerialQueue();
  regroupOnEvents(enqueue);
});

/** タブ・ルールの変更や起動のイベントを受け、グループを作り直す処理を enqueue に積む */
function regroupOnEvents(enqueue: ReturnType<typeof createSerialQueue>): void {
  browser.runtime.onInstalled.addListener(
    logListenerErrors(logger, (details) => {
      logger.info("拡張機能がインストール・更新されました（{reason}）", { reason: details.reason });
      void enqueue(regroupAll);
    }),
  );
  browser.runtime.onStartup.addListener(
    logListenerErrors(logger, () => {
      logger.info("ブラウザが起動しました");
      void enqueue(regroupAll);
    }),
  );

  // 手で管理対象のグループへ入れた・外したタブを関係ないイベントで戻さないよう、イベントのタブだけを判定する。
  // 新しいタブも URL が決まった時点で onUpdated が来るため、onCreated は購読しない
  browser.tabs.onUpdated.addListener(
    logListenerErrors(logger, (tabId, changeInfo, tab) => {
      if (changeInfo.url !== undefined) {
        logger.debug("タブ {tabId} の URL が変わりました", { tabId, windowId: tab.windowId });
        void enqueue(async () => regroupTabs(await rulesReader.read(), tab.windowId, [tabId]));
      }
    }),
  );
  browser.tabs.onAttached.addListener(
    logListenerErrors(logger, (tabId, attachInfo) => {
      logger.debug("タブ {tabId} がウィンドウ {windowId} へ移りました", { tabId, windowId: attachInfo.newWindowId });
      void enqueue(async () => regroupTabs(await rulesReader.read(), attachInfo.newWindowId, [tabId]));
    }),
  );

  // storage の変更の通知も chrome.storage.onChanged のリスナーから呼ばれる。
  // debounceChanges は処理を setTimeout の中で呼び、処理の例外は error イベントに届くため、今は包まなくても記録される。
  // debounceChanges が処理を同期で呼ぶように変わっても記録するよう包む
  rulesReader.watch(
    logListenerErrors(
      logger,
      debounceChanges(RULE_CHANGE_DEBOUNCE_MS, (newRules, oldRules) => {
        logger.debug("ルールが変わりました（{oldCount} 件 → {newCount} 件）", {
          oldCount: oldRules.length,
          newCount: newRules.length,
        });
        void enqueue(async () => applyRuleChange(oldRules, newRules));
      }),
    ),
  );
}
