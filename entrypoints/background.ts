import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { debounceChanges } from "../utils/grouping/debounce";
import { applyRuleChange, regroupAllWindows, regroupTabs } from "../utils/grouping/regroup";
import { createSerialQueue } from "../utils/grouping/serial";
import { configureLogging, getAppLogger } from "../utils/logging/setup";
import { rulesItem } from "../utils/rules/storage";

/** 設定画面は入力のたびに保存するため、入力途中の名前でグループを作り直し続けないよう待つ時間 */
const RULE_CHANGE_DEBOUNCE_MS = 300;

async function regroupAll(): Promise<void> {
  await regroupAllWindows(await rulesItem.getValue());
}

const logger = getAppLogger("background");

/** 拡張機能のコードが捕捉しなかったエラーをログに残す。Service Worker の最初の評価の中で登録する必要がある */
function logUncaughtErrors(): void {
  globalThis.addEventListener("error", (event: ErrorEvent) => {
    logger.error("捕捉されないエラーが起きました", { error: event.error });
  });
  globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    logger.error("捕捉されない Promise の拒否が起きました", { error: event.reason });
  });
}

export default defineBackground(() => {
  configureLogging({ dev: import.meta.env.DEV });
  logUncaughtErrors();

  // グループを作ってからタイトルを付けるまでに別のイベントを処理すると同名のグループが2つできるため、処理を直列にする。
  // 各処理は開始時にルールとスナップショットを読み直す
  const enqueue = createSerialQueue();

  browser.runtime.onInstalled.addListener((details) => {
    logger.info("拡張機能がインストール・更新されました（{reason}）", { reason: details.reason });
    void enqueue(regroupAll);
  });
  browser.runtime.onStartup.addListener(() => {
    logger.info("ブラウザが起動しました");
    void enqueue(regroupAll);
  });

  // 手で管理対象のグループへ入れた・外したタブを関係ないイベントで戻さないよう、イベントのタブだけを判定する。
  // 新しいタブも URL が決まった時点で onUpdated が来るため、onCreated は購読しない
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined) {
      logger.debug("タブ {tabId} の URL が変わりました", { tabId, windowId: tab.windowId });
      void enqueue(async () => regroupTabs(await rulesItem.getValue(), tab.windowId, [tabId]));
    }
  });
  browser.tabs.onAttached.addListener((tabId, attachInfo) => {
    logger.debug("タブ {tabId} がウィンドウ {windowId} へ移りました", { tabId, windowId: attachInfo.newWindowId });
    void enqueue(async () => regroupTabs(await rulesItem.getValue(), attachInfo.newWindowId, [tabId]));
  });

  rulesItem.watch(
    debounceChanges(RULE_CHANGE_DEBOUNCE_MS, (newRules, oldRules) => {
      logger.debug("ルールが変わりました（{oldCount} 件 → {newCount} 件）", {
        oldCount: oldRules.length,
        newCount: newRules.length,
      });
      void enqueue(async () => applyRuleChange(oldRules, newRules));
    }),
  );
});
