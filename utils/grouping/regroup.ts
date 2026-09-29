import type { Rule } from "../rules/types";
import { executeOperations } from "./execute";
import { planGrouping } from "./plan";
import { diffRules, planGroupUpdates } from "./rule-change";
import { takeWindowSnapshots } from "./snapshot";

/** ウィンドウの指定したタブだけを判定し、ルールのグループへ入れる・外す */
export async function regroupTabs(rules: readonly Rule[], windowId: number, tabIds: readonly number[]): Promise<void> {
  const windows = await takeWindowSnapshots(windowId);
  await Promise.all(
    windows.map(async (window) => executeOperations(planGrouping(window, rules, { targetTabIds: new Set(tabIds) }))),
  );
}

/** すべてのウィンドウのすべてのタブを判定し直す。retiredNames のグループも管理対象として扱う */
export async function regroupAllWindows(rules: readonly Rule[], retiredNames: readonly string[] = []): Promise<void> {
  const windows = await takeWindowSnapshots();
  // グループはウィンドウごとに作るため、ウィンドウをまたいで操作が干渉しない
  await Promise.all(windows.map(async (window) => executeOperations(planGrouping(window, rules, { retiredNames }))));
}

/**
 * ルールの変更を開いているタブに反映する。
 * 名前・色が変わったルールのグループのタイトル・色を先に変え、その後にスナップショットを取り直して全体を判定し直す
 */
export async function applyRuleChange(oldRules: readonly Rule[], newRules: readonly Rule[]): Promise<void> {
  const { updates, retiredNames } = diffRules(oldRules, newRules);
  if (updates.length > 0) {
    const windows = await takeWindowSnapshots();
    await Promise.all(windows.map(async (window) => executeOperations(planGroupUpdates(window, updates))));
  }
  await regroupAllWindows(newRules, retiredNames);
}
