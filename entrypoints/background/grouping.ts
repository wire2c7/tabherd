import { browser } from "wxt/browser";

import { debounceChanges } from "../../utils/grouping/debounce";
import type { RulesState } from "../../utils/grouping/regroup";
import { applyRuleChange, regroupTabs } from "../../utils/grouping/regroup";
import type { createSerialQueue } from "../../utils/grouping/serial";
import { logListenerErrors } from "../../utils/logging/listener";
import { getAppLogger } from "../../utils/logging/setup";
import { browserTabs } from "../platform/tabs";
import { showUnusedRules } from "./badge";
import { readRulesState, rulesReader, titlesStore } from "./rules";

/** 設定画面は入力のたびに保存するため、入力途中の名前でグループを作り直し続けないよう待つ時間 */
const RULE_CHANGE_DEBOUNCE_MS = 300;

const logger = getAppLogger("background");

/**
 * oldRules から state.rules への変更を反映し、変更後にルールが持っているタイトルを保存する。
 * 使われないルールのバッジも、反映後のタイトルで数えて更新する（300ms まとめた後のため、打ち直しの途中でちらつきにくい）
 */
async function applyAndSaveTitles(oldRules: RulesState["rules"], state: RulesState): Promise<void> {
  const titles = await applyRuleChange(browserTabs, oldRules, state);
  await titlesStore.write(titles);
  await showUnusedRules({ rules: state.rules, titles });
}

/** すべてのタブを判定し直す。記録したタイトルとルールが食い違っていれば、グループのタイトル・色も直す */
async function regroupAll(): Promise<void> {
  const state = await readRulesState();
  await applyAndSaveTitles(state.rules, state);
}

/** ウィンドウ windowId のタブ tabId を判定し直す処理を作る */
function regroupTab(windowId: number, tabId: number): () => Promise<void> {
  return async () => regroupTabs(browserTabs, await readRulesState(), { windowId, tabIds: [tabId] });
}

/** タブ・ルールの変更や起動のイベントを受け、グループを作り直す処理を enqueue に積む */
export function regroupOnEvents(enqueue: ReturnType<typeof createSerialQueue>): void {
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
        void enqueue(regroupTab(tab.windowId, tabId));
      }
    }),
  );
  browser.tabs.onAttached.addListener(
    logListenerErrors(logger, (tabId, attachInfo) => {
      logger.debug("タブ {tabId} がウィンドウ {windowId} へ移りました", { tabId, windowId: attachInfo.newWindowId });
      void enqueue(regroupTab(attachInfo.newWindowId, tabId));
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
        void enqueue(async () => applyAndSaveTitles(oldRules, { rules: newRules, titles: await titlesStore.read() }));
      }),
    ),
  );
}
