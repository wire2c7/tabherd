import { matchesRule, validRules } from "../rules/match";
import type { Rule } from "../rules/types";
import type { GroupOperation, GroupSnapshot, TabIds, TabSnapshot, WindowSnapshot } from "./types";

/** tabGroups.TAB_GROUP_ID_NONE。純粋関数からブラウザの API を参照しないよう値で持つ */
export const TAB_GROUP_ID_NONE = -1;

export interface PlanGroupingOptions {
  /** 判定するタブの ID。省略するとウィンドウのすべてのタブを判定する */
  targetTabIds?: ReadonlySet<number>;
  /** 削除されたルール等の旧い名前。有効なルールの名前でなくても、このタイトルのグループを管理対象として扱う */
  retiredNames?: readonly string[];
}

/** 1つのタブの判定の結果。keep は操作なし、ungroup はグループから外す、group はルールのグループへ入れる */
type TabDecision = { type: "keep" } | { type: "ungroup" } | { type: "group"; rule: Rule };

interface DecisionContext {
  activeRules: readonly Rule[];
  managedTitles: ReadonlySet<string>;
  groupsById: ReadonlyMap<number, GroupSnapshot>;
}

function decideTab(tab: TabSnapshot, context: DecisionContext): TabDecision {
  if (tab.pinned) {
    return { type: "keep" };
  }
  const currentGroup = tab.groupId === TAB_GROUP_ID_NONE ? null : context.groupsById.get(tab.groupId);
  // スナップショットにない（undefined）・管理対象でないグループのタブには触れない
  if (currentGroup === undefined || (currentGroup !== null && !context.managedTitles.has(currentGroup.title))) {
    return { type: "keep" };
  }
  const rule = context.activeRules.find((candidate) => matchesRule(tab.url, candidate));
  if (rule === undefined) {
    return currentGroup === null ? { type: "keep" } : { type: "ungroup" };
  }
  // 同名のグループが複数あるときは、左でないほうに入っていても動かさない
  return currentGroup?.title === rule.name ? { type: "keep" } : { type: "group", rule };
}

// タブは左から順に並んでいるため、最初に見つかったグループが同名のグループのうち左のもの
function findLeftmostGroupIds(
  window: WindowSnapshot,
  groupsById: ReadonlyMap<number, GroupSnapshot>,
): Map<string, number> {
  const leftmost = new Map<string, number>();
  for (const tab of window.tabs) {
    const group = groupsById.get(tab.groupId);
    if (group !== undefined && !leftmost.has(group.title)) {
      leftmost.set(group.title, group.id);
    }
  }
  return leftmost;
}

function appendTabId<K>(map: Map<K, TabIds>, key: K, tabId: number): void {
  const tabIds = map.get(key);
  if (tabIds === undefined) {
    map.set(key, [tabId]);
  } else {
    tabIds.push(tabId);
  }
}

/**
 * ウィンドウのスナップショットとルールの一覧から、タブをルールのグループへ入れる・外す操作の計画を組み立てる。
 * ピン留めされたタブと、管理対象でないグループのタブには操作を出さない
 */
export function planGrouping(
  window: WindowSnapshot,
  rules: readonly Rule[],
  options: PlanGroupingOptions = {},
): GroupOperation[] {
  const { targetTabIds, retiredNames = [] } = options;
  const activeRules = validRules(rules);
  const groupsById = new Map(window.groups.map((group) => [group.id, group]));
  const context: DecisionContext = {
    activeRules,
    managedTitles: new Set([...activeRules.map((rule) => rule.name), ...retiredNames]),
    groupsById,
  };
  const leftmostGroupIds = findLeftmostGroupIds(window, groupsById);

  const removals: number[] = [];
  const additions = new Map<number, TabIds>();
  const creations = new Map<Rule, TabIds>();
  const targetTabs = window.tabs.filter((tab) => targetTabIds?.has(tab.id) ?? true);
  for (const tab of targetTabs) {
    const decision = decideTab(tab, context);
    if (decision.type === "ungroup") {
      removals.push(tab.id);
    } else if (decision.type === "group") {
      const groupId = leftmostGroupIds.get(decision.rule.name);
      if (groupId === undefined) {
        appendTabId(creations, decision.rule, tab.id);
      } else {
        appendTabId(additions, groupId, tab.id);
      }
    }
  }

  const operations: GroupOperation[] = [];
  const [firstRemoval, ...restRemovals] = removals;
  if (firstRemoval !== undefined) {
    operations.push({ type: "ungroup", tabIds: [firstRemoval, ...restRemovals] });
  }
  for (const [groupId, tabIds] of additions) {
    operations.push({ type: "add-to-group", groupId, tabIds });
  }
  for (const [rule, tabIds] of creations) {
    operations.push({ type: "create-group", windowId: window.id, title: rule.name, color: rule.color, tabIds });
  }
  return operations;
}
