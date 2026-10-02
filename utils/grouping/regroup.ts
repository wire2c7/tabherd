import { getAppLogger } from "../logging/setup";
import type { Rule } from "../rules/types";
import { executeOperations } from "./execute";
import { planGroupOrder } from "./order";
import type { PlanGroupingOptions } from "./plan";
import { planGrouping } from "./plan";
import { diffRules, planGroupUpdates } from "./rule-change";
import { takeWindowSnapshots } from "./snapshot";
import type { WindowSnapshot } from "./types";

const logger = getAppLogger("grouping");

/**
 * 1つのウィンドウのタブをルールのグループへ入れる・外し、その後にグループの並びをルールの順に揃える。
 * 並びはグループの大きさが変わった後の位置で計算するため、グループ化の操作があればスナップショットを取り直す
 */
async function groupAndArrange(
  window: WindowSnapshot,
  rules: readonly Rule[],
  options: PlanGroupingOptions,
): Promise<void> {
  const operations = planGrouping(window, rules, options);
  logger.debug("ウィンドウ {windowId} のタブ {tabCount} 件から、グループ化の操作を {operationCount} 件計画しました", {
    windowId: window.id,
    tabCount: window.tabs.length,
    operationCount: operations.length,
  });
  let latest: WindowSnapshot | undefined = window;
  if (operations.length > 0) {
    await executeOperations(operations);
    [latest] = await takeWindowSnapshots(window.id);
  }
  if (latest !== undefined) {
    const moves = planGroupOrder(latest, rules);
    logger.debug("ウィンドウ {windowId} のグループの並べ替えを {operationCount} 件計画しました", {
      windowId: window.id,
      operationCount: moves.length,
    });
    await executeOperations(moves);
  }
}

/** ウィンドウの指定したタブだけを判定し、ルールのグループへ入れる・外す。その後にウィンドウのグループの並びを揃える */
export async function regroupTabs(rules: readonly Rule[], windowId: number, tabIds: readonly number[]): Promise<void> {
  logger.debug("ウィンドウ {windowId} のタブ {tabIds} を判定します", { windowId, tabIds });
  const windows = await takeWindowSnapshots(windowId);
  await Promise.all(windows.map(async (window) => groupAndArrange(window, rules, { targetTabIds: new Set(tabIds) })));
}

/**
 * すべてのウィンドウのすべてのタブを判定し直し、グループの並びを揃える。retiredNames のグループも管理対象として扱う。
 * ルールの順番だけが変わったときは、グループ化の操作がなく並びだけが変わる
 */
export async function regroupAllWindows(rules: readonly Rule[], retiredNames: readonly string[] = []): Promise<void> {
  const windows = await takeWindowSnapshots();
  logger.debug("すべてのウィンドウ（{windowCount} 件）のタブを判定し直します", { windowCount: windows.length });
  // グループはウィンドウごとに作るため、ウィンドウをまたいで操作が干渉しない
  await Promise.all(windows.map(async (window) => groupAndArrange(window, rules, { retiredNames })));
}

/**
 * ルールの変更を開いているタブに反映する。
 * 名前・色が変わったルールのグループのタイトル・色を先に変え、その後にスナップショットを取り直して全体を判定し直す
 */
export async function applyRuleChange(oldRules: readonly Rule[], newRules: readonly Rule[]): Promise<void> {
  const { updates, retiredNames } = diffRules(oldRules, newRules);
  logger.debug(
    "ルールの変更を反映します（名前・色の変わったグループ {updateCount} 件、使われなくなった名前 {retiredCount} 件）",
    {
      updateCount: updates.length,
      retiredCount: retiredNames.length,
    },
  );
  if (updates.length > 0) {
    const windows = await takeWindowSnapshots();
    await Promise.all(windows.map(async (window) => executeOperations(planGroupUpdates(window, updates))));
  }
  await regroupAllWindows(newRules, retiredNames);
}
