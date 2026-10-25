import { browser } from "wxt/browser";
import type { Browser } from "wxt/browser";

import { debounceChanges } from "../../utils/grouping/debounce";
import type { RulesState } from "../../utils/grouping/regroup";
import { applyRuleChange, regroupTabs } from "../../utils/grouping/regroup";
import { currentTitles } from "../../utils/grouping/rule-change";
import type { createSerialQueue } from "../../utils/grouping/serial";
import { logListenerErrors } from "../../utils/logging/listener";
import { getAppLogger } from "../../utils/logging/setup";
import { browserTabs } from "../platform/tabs";
import { showUnusedRules } from "./badge";
import { readRulesState, rulesReader, titlesStore } from "./rules";

/** 設定画面は入力のたびに保存するため、入力途中の名前でグループを作り直し続けないよう待つ時間 */
const RULE_CHANGE_DEBOUNCE_MS = 300;

/** ページ読み込み中にタイトルが何度も変わり続けないよう待つ時間。ルール変更より連続して起こりやすいため、やや長くする */
const TITLE_CHANGE_DEBOUNCE_MS = 500;

/** タブ ID ごとのタイトル変化のデバウンス */
type TitleDebounceByTab = Map<number, ReturnType<typeof debounceChanges<string>>>;

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

/**
 * ウィンドウ windowId のタブ tabId を判定し直す処理を作る。
 *
 * @param windowId - 対象のタブが属するウィンドウの ID
 * @param tabId - 判定し直す対象のタブの ID
 * @returns enqueue に積む処理
 * @remarks 判定に使ったルールの今の有効なタイトルを titlesStore にも記録する。これをしないと、このタブイベントが
 * ルールの変更の反映より先にグループを作った場合、そのグループの存在が diffRules の記録から漏れ、
 * 後から確定する名前・色の変更がそのグループへ届かなくなる（Issue #36）
 */
export function regroupTab(windowId: number, tabId: number): () => Promise<void> {
  return async () => {
    const state = await readRulesState();
    await regroupTabs(browserTabs, state, { windowId, tabIds: [tabId] });
    await titlesStore.write(currentTitles(state.rules, state.titles));
  };
}

/**
 * ルールの変更（storage の watch）を受け、区間の最初の変更があった時点で反映のタスクを積む。
 *
 * @param enqueue - 積んだ処理を直列に実行する関数
 * @param ruleChangeDebounce - ルール変更をまとめる debounceChanges の関数
 * @returns rulesReader.watch へ渡すリスナー
 * @remarks 区間の確定を待つのはこの反映のタスク自身で、enqueue するタイミングは区間の最初の変更が
 * あった時点のまま動かさない。これにより、確定前にタブイベントがキューへ積まれても、この反映のタスクより
 * 後ろに並ぶため、確定した後の正しい rules・titles で判定できる（Issue #36・#81）。
 * 区間の oldRules・newRules は ruleChangeDebounce 自身が確定時点の値として持つため、
 * 反映のタスクが実行されるまでに次の区間が始まっていても、古い区間の値のまま反映してしまうことがない（Issue #36 の再発）
 */
export function onRulesChanged(
  enqueue: ReturnType<typeof createSerialQueue>,
  ruleChangeDebounce: ReturnType<typeof debounceChanges<RulesState["rules"]>>,
): (newRules: RulesState["rules"], oldRules: RulesState["rules"]) => void {
  return (newRules, oldRules) => {
    const settled = ruleChangeDebounce(newRules, oldRules);
    if (settled === undefined) {
      return;
    }
    logger.debug("ルールが変わりました（{oldCount} 件 → {newCount} 件）", {
      oldCount: oldRules.length,
      newCount: newRules.length,
    });
    void enqueue(async () => {
      const { oldValue, newValue } = await settled;
      await applyAndSaveTitles(oldValue, { rules: newValue, titles: await titlesStore.read() });
    });
  };
}

/**
 * タブのタイトルの変化（storage ではなく browser.tabs.onUpdated）を受け、タブごとにデバウンスした上で
 * 区間の最初の変更があった時点で判定し直しのタスクを積む。
 *
 * @param enqueue - 積んだ処理を直列に実行する関数
 * @param debounceByTab - タブ ID ごとのデバウンス関数を持つ Map
 * @returns browser.tabs.onUpdated へ渡すリスナー
 * @remarks ページ読み込み中はタイトルが何度も変わるため、タブごとに debounceChanges でまとめる。
 * enqueue するタイミングは区間の最初の変更があった時点のままにし、区間の確定を待つのはこの判定し直しのタスク自身にする
 * （onRulesChanged と同じ考え方）
 */
export function onTitleChanged(
  enqueue: ReturnType<typeof createSerialQueue>,
  debounceByTab: TitleDebounceByTab,
): (tabId: number, changeInfo: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) => void {
  return (tabId, changeInfo, tab) => {
    if (changeInfo.title === undefined) {
      return;
    }
    let debounce = debounceByTab.get(tabId);
    if (debounce === undefined) {
      debounce = debounceChanges<string>(TITLE_CHANGE_DEBOUNCE_MS);
      debounceByTab.set(tabId, debounce);
    }
    const settled = debounce(changeInfo.title, tab.title ?? "");
    if (settled === undefined) {
      return;
    }
    logger.debug("タブ {tabId} のタイトルが変わりました", { tabId, windowId: tab.windowId });
    void enqueue(async () => {
      await settled;
      await regroupTab(tab.windowId, tabId)();
    });
  };
}

/**
 * タブが閉じられたときに、そのタブのタイトル変化のデバウンスを片付ける。
 *
 * @param debounceByTab - タブ ID ごとのデバウンス関数を持つ Map
 * @returns browser.tabs.onRemoved へ渡すリスナー
 * @remarks 片付けないと、閉じたタブの分だけ Map が際限なく育ち続ける
 */
export function onTabRemoved(debounceByTab: TitleDebounceByTab): (tabId: number) => void {
  return (tabId) => {
    debounceByTab.delete(tabId);
  };
}

/**
 * タブ・ルールの変更や起動のイベントを受け、グループを作り直す処理を enqueue に積む。
 *
 * @param enqueue - 積んだ処理を直列に実行する関数
 * @remarks タブイベントは、進行中のルール変更があっても待たずにそのまま enqueue する（onRulesChanged を参照）
 */
export function regroupOnEvents(enqueue: ReturnType<typeof createSerialQueue>): void {
  const ruleChangeDebounce = debounceChanges<RulesState["rules"]>(RULE_CHANGE_DEBOUNCE_MS);
  const titleChangeDebounce: TitleDebounceByTab = new Map();

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
  browser.tabs.onUpdated.addListener(logListenerErrors(logger, onTitleChanged(enqueue, titleChangeDebounce)));
  browser.tabs.onRemoved.addListener(logListenerErrors(logger, onTabRemoved(titleChangeDebounce)));

  // onRulesChanged 自体は同期の処理のため、ここで包んで例外を記録する。
  // enqueue したタスク（反映処理）の例外は createSerialQueue 自身が記録する
  rulesReader.watch(logListenerErrors(logger, onRulesChanged(enqueue, ruleChangeDebounce)));
}
