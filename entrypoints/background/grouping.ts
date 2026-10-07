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
 * 使われないルールのバッジも、反映後のタイトルで数えて更新する（300ms まとめた後のため、打ち直しの途中でちらつきにくい）。
 * 反映が失敗しても、ルールの変更をバッジに映すため、それまでのタイトルで更新する
 */
async function applyAndSaveTitles(oldRules: RulesState["rules"], state: RulesState): Promise<void> {
  let { titles } = state;
  try {
    titles = await applyRuleChange(browserTabs, oldRules, state);
    await titlesStore.write(titles);
  } finally {
    await showUnusedRules({ rules: state.rules, titles });
  }
}

/**
 * 保存されたルールで、使われないルールのバッジを更新する。
 *
 * @remarks Service Worker の起動時に呼ぶ。拡張機能を無効にしてから有効に戻すと、アイコンの状態が消え、インストール・ブラウザの起動のイベントも来ないため
 */
export async function refreshUnusedRulesBadge(): Promise<void> {
  await showUnusedRules(await readRulesState());
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

/**
 * ルールの変更（storage の watch）を受け、バーストの最初の変更があった時点で反映のタスクを積む。
 *
 * @param enqueue - 積んだ処理を直列に実行する関数
 * @param ruleChangeDebounce - ルール変更のデバウンス
 * @returns rulesReader.watch へ渡すリスナー
 * @remarks デバウンスの確定を待つのはこの反映のタスク自身で、enqueue するタイミングはバーストの最初の変更が
 * あった時点のまま動かさない。これにより、確定前にタブイベントがキューへ積まれても、この反映のタスクより
 * 後ろに並ぶため、確定した後の正しい rules・titles で判定できる（Issue #36・#81）
 */
function onRulesChanged(
  enqueue: ReturnType<typeof createSerialQueue>,
  ruleChangeDebounce: ReturnType<typeof debounceChanges<RulesState["rules"]>>,
): (newRules: RulesState["rules"], oldRules: RulesState["rules"]) => void {
  let isBurstPending = false;
  return (newRules, oldRules) => {
    logger.debug("ルールが変わりました（{oldCount} 件 → {newCount} 件）", {
      oldCount: oldRules.length,
      newCount: newRules.length,
    });
    ruleChangeDebounce.onChange(newRules, oldRules);
    if (isBurstPending) {
      return;
    }
    isBurstPending = true;
    void enqueue(async () => {
      await ruleChangeDebounce.waitUntilSettled();
      const state = await readRulesState();
      isBurstPending = false;
      await applyAndSaveTitles(oldRules, state);
    });
  };
}

/**
 * タブ・ルールの変更や起動のイベントを受け、グループを作り直す処理を enqueue に積む。
 *
 * @param enqueue - 積んだ処理を直列に実行する関数
 * @remarks タブイベントは、進行中のルール変更があっても待たずにそのまま enqueue する（onRulesChanged を参照）
 */
export function regroupOnEvents(enqueue: ReturnType<typeof createSerialQueue>): void {
  const ruleChangeDebounce = debounceChanges<RulesState["rules"]>(RULE_CHANGE_DEBOUNCE_MS, () => {
    // 実際の反映は onRulesChanged が積むタスク自身が行うため、ここでは何もしない
  });

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
  rulesReader.watch(logListenerErrors(logger, onRulesChanged(enqueue, ruleChangeDebounce)));
}
