import { getAppLogger } from "../logging/setup";
import type { Rule, RuleTitles } from "../rules/types";
import { executeOperations } from "./execute";
import { planGroupOrder } from "./order";
import type { PlanGroupingOptions } from "./plan";
import { planGrouping } from "./plan";
import { diffRules, planGroupUpdates } from "./rule-change";
import { takeWindowSnapshots } from "./snapshot";
import type { TabsApi } from "./tabs";
import type { WindowSnapshot } from "./types";

const logger = getAppLogger("grouping");

/** ルールの一覧と、ルールが持っているグループのタイトル */
export interface RulesState {
  rules: readonly Rule[];
  titles: RuleTitles;
}

/** 1つのウィンドウのグループ化で使うルールと、判定するタブ・管理対象のグループ名 */
interface GroupingRequest {
  rules: readonly Rule[];
  options: PlanGroupingOptions;
}

/**
 * 1つのウィンドウのタブをルールのグループへ入れる・外し、その後にグループの並びをルールの順に揃える。
 * 並びはグループの大きさが変わった後の位置で計算するため、グループ化の操作があればスナップショットを取り直す
 */
async function groupAndArrange(
  api: TabsApi,
  window: WindowSnapshot,
  { rules, options }: GroupingRequest,
): Promise<void> {
  const operations = planGrouping(window, rules, options);
  logger.debug("ウィンドウ {windowId} のタブ {tabCount} 件から、グループ化の操作を {operationCount} 件計画しました", {
    windowId: window.id,
    tabCount: window.tabs.length,
    operationCount: operations.length,
  });
  let latest: WindowSnapshot | undefined = window;
  if (operations.length > 0) {
    await executeOperations(api, operations);
    [latest] = await takeWindowSnapshots(api, window.id);
  }
  if (latest !== undefined) {
    const moves = planGroupOrder(latest, rules, options.titles);
    logger.debug("ウィンドウ {windowId} のグループの並べ替えを {operationCount} 件計画しました", {
      windowId: window.id,
      operationCount: moves.length,
    });
    await executeOperations(api, moves);
  }
}

/**
 * ウィンドウの指定したタブだけを判定し、ルールのグループへ入れる・外す。その後にウィンドウのグループの並びを揃える。
 *
 * @param api - 操作を実行するタブの API
 * @param state - 判定に使うルールの一覧と、ルールが持っているグループのタイトル
 * @param target - 判定するウィンドウとタブの ID
 */
export async function regroupTabs(
  api: TabsApi,
  { rules, titles }: RulesState,
  { windowId, tabIds }: { windowId: number; tabIds: readonly number[] },
): Promise<void> {
  logger.debug("ウィンドウ {windowId} のタブ {tabIds} を判定します", { windowId, tabIds });
  const windows = await takeWindowSnapshots(api, windowId);
  await Promise.all(
    windows.map(async (window) =>
      groupAndArrange(api, window, { rules, options: { targetTabIds: new Set(tabIds), titles } }),
    ),
  );
}

/**
 * すべてのウィンドウのすべてのタブを判定し直し、グループの並びを揃える。
 *
 * @param api - 操作を実行するタブの API
 * @param state - 判定に使うルールの一覧と、ルールが持っているグループのタイトル
 * @param retiredNames - 管理対象として扱う、削除されたルール等の旧い名前
 * @remarks ルールの順番だけが変わったときは、グループ化の操作がなく並びだけが変わる
 */
export async function regroupAllWindows(
  api: TabsApi,
  { rules, titles }: RulesState,
  retiredNames: readonly string[] = [],
): Promise<void> {
  const windows = await takeWindowSnapshots(api);
  logger.debug("すべてのウィンドウ（{windowCount} 件）のタブを判定し直します", { windowCount: windows.length });
  // グループはウィンドウごとに作るため、ウィンドウをまたいで操作が干渉しない
  await Promise.all(
    windows.map(async (window) => groupAndArrange(api, window, { rules, options: { retiredNames, titles } })),
  );
}

/**
 * ルールの変更を開いているタブに反映し、変更後にルールが持っているタイトルを返す。
 *
 * @param api - 操作を実行するタブの API
 * @param oldRules - 変更前のルールの一覧
 * @param state - 変更後のルールの一覧と、変更前にルールが持っていたタイトル（state.titles）
 * @returns 変更後にルールが持っているタイトル
 * @remarks 名前・色が変わったルールのグループのタイトル・色を先に変え、その後にスナップショットを取り直して全体を判定し直す。起動時は oldRules に今のルールを渡し、記録とルールの食い違いを直す
 */
export async function applyRuleChange(
  api: TabsApi,
  oldRules: readonly Rule[],
  { rules, titles }: RulesState,
): Promise<Map<string, string>> {
  const change = diffRules(oldRules, rules, titles);
  logger.debug(
    "ルールの変更を反映します（名前・色の変わったグループ {updateCount} 件、使われなくなった名前 {retiredCount} 件）",
    {
      updateCount: change.updates.length,
      retiredCount: change.retiredNames.length,
    },
  );
  if (change.updates.length > 0) {
    const windows = await takeWindowSnapshots(api);
    await Promise.all(windows.map(async (window) => executeOperations(api, planGroupUpdates(window, change.updates))));
  }
  await regroupAllWindows(api, { rules, titles: change.titles }, change.retiredNames);
  return change.titles;
}
