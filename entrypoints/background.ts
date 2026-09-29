import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";

import { debounceChanges } from "../utils/grouping/debounce";
import { applyRuleChange, regroupAllWindows, regroupTabs } from "../utils/grouping/regroup";
import { createSerialQueue } from "../utils/grouping/serial";
import { rulesItem } from "../utils/rules/storage";

/** 設定画面は入力のたびに保存するため、入力途中の名前でグループを作り直し続けないよう待つ時間 */
const RULE_CHANGE_DEBOUNCE_MS = 300;

async function regroupAll(): Promise<void> {
  await regroupAllWindows(await rulesItem.getValue());
}

export default defineBackground(() => {
  // グループを作ってからタイトルを付けるまでに別のイベントを処理すると同名のグループが2つできるため、処理を直列にする。
  // 各処理は開始時にルールとスナップショットを読み直す
  const enqueue = createSerialQueue();

  browser.runtime.onInstalled.addListener(() => {
    void enqueue(regroupAll);
  });
  browser.runtime.onStartup.addListener(() => {
    void enqueue(regroupAll);
  });

  // 手で管理対象のグループへ入れた・外したタブを関係ないイベントで戻さないよう、イベントのタブだけを判定する。
  // 新しいタブも URL が決まった時点で onUpdated が来るため、onCreated は購読しない
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined) {
      void enqueue(async () => regroupTabs(await rulesItem.getValue(), tab.windowId, [tabId]));
    }
  });
  browser.tabs.onAttached.addListener((tabId, attachInfo) => {
    void enqueue(async () => regroupTabs(await rulesItem.getValue(), attachInfo.newWindowId, [tabId]));
  });

  rulesItem.watch(
    debounceChanges(RULE_CHANGE_DEBOUNCE_MS, (newRules, oldRules) => {
      void enqueue(async () => applyRuleChange(oldRules, newRules));
    }),
  );
});
