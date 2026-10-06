// タブの操作の計画をスナップショットに適用するテスト用のモデル
import { TAB_GROUP_ID_NONE } from "../plan";
import type { GroupOperation, TabSnapshot, WindowSnapshot } from "../types";

function withGroupId(window: WindowSnapshot, tabIds: readonly number[], groupId: number): TabSnapshot[] {
  const ids = new Set(tabIds);
  return window.tabs.map((tab) => (ids.has(tab.id) ? { ...tab, groupId } : tab));
}

// スナップショットに載っていないグループ（取得の途中で変わったもの）も、タブがあれば Chrome には存在する
function groupExists(window: WindowSnapshot, groupId: number): boolean {
  return window.groups.some(({ id }) => id === groupId) || window.tabs.some((tab) => tab.groupId === groupId);
}

// Chrome はタブが無くなったグループを消す
function withoutEmptyGroups(window: WindowSnapshot): WindowSnapshot {
  const usedIds = new Set(window.tabs.map((tab) => tab.groupId));
  return { ...window, groups: window.groups.filter((group) => usedIds.has(group.id)) };
}

// グループのタブを取り出し、先頭が index に来るよう差し込む。
// 右への移動は、Chrome の index の解釈が取り出す前か後かで変わるため受け付けない（planGroupOrder は左にしか動かさない）
function moveGroup(window: WindowSnapshot, groupId: number, index: number): WindowSnapshot {
  const from = window.tabs.findIndex((tab) => tab.groupId === groupId);
  if (from === -1 || index > from) {
    throw new Error(`グループ ${groupId} を ${from} から ${index} へは動かせない`);
  }
  const moving = window.tabs.filter((tab) => tab.groupId === groupId);
  const rest = window.tabs.filter((tab) => tab.groupId !== groupId);
  return { ...window, tabs: rest.toSpliced(index, 0, ...moving) };
}

/**
 * 計画の1手順をスナップショットに適用する。グループに入れる・外す操作はタブの所属だけを変え、位置は変えない
 * （Chrome は位置も変えるが、planGrouping の判定は所属とタイトルで決まるため）
 */
function applyOperation(window: WindowSnapshot, operation: GroupOperation): WindowSnapshot {
  switch (operation.type) {
    case "ungroup": {
      return withoutEmptyGroups({ ...window, tabs: withGroupId(window, operation.tabIds, TAB_GROUP_ID_NONE) });
    }
    case "add-to-group": {
      // Chrome では、無くなったグループへ入れる操作は失敗し、executeOperations はそのまま次の操作へ進む
      if (!groupExists(window, operation.groupId)) {
        return window;
      }
      const tabs = withGroupId(window, operation.tabIds, operation.groupId);
      return withoutEmptyGroups({ ...window, tabs });
    }
    case "create-group": {
      const groupId = Math.max(99, ...window.tabs.map((tab) => tab.groupId), ...window.groups.map(({ id }) => id)) + 1;
      const group = { id: groupId, title: operation.title, color: operation.color };
      const tabs = withGroupId(window, operation.tabIds, groupId);
      return withoutEmptyGroups({ ...window, tabs, groups: [...window.groups, group] });
    }
    case "update-group": {
      const { groupId, title, color } = operation;
      const groups = window.groups.map((group) => (group.id === groupId ? { ...group, title, color } : group));
      return { ...window, groups };
    }
    case "move-group": {
      return moveGroup(window, operation.groupId, operation.index);
    }
    default: {
      return operation satisfies never;
    }
  }
}

/**
 * 計画の操作を順にスナップショットへ適用する。
 *
 * @param window - 適用前のウィンドウのスナップショット
 * @param operations - 順に適用する操作
 * @returns 適用後のウィンドウのスナップショット
 */
export function applyOperations(window: WindowSnapshot, operations: readonly GroupOperation[]): WindowSnapshot {
  let applied = window;
  for (const operation of operations) {
    applied = applyOperation(applied, operation);
  }
  return applied;
}
