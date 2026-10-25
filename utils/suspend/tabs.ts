import type { GroupColor } from "../rules/types";

/** サスペンドの絞り込みに使う、ブラウザのタブの情報 */
export interface SuspendTab {
  /** 開発者ツール等のタブは ID を持たない */
  id?: number | undefined;
  pinned: boolean;
  active: boolean;
}

/** ウィンドウに存在するタブグループと、そのグループに属するタブ */
export interface SuspendTabGroup {
  id: number;
  windowId: number;
  title?: string | undefined;
  color: GroupColor;
  tabs: readonly SuspendTab[];
}

/**
 * タブグループ単位のサスペンドに使う、ブラウザのタブ・タブグループの API。
 * WXT による実装は entrypoints/platform/suspend-tabs.ts
 *
 * @remarks グルーピングの計画には関わらないため、utils/grouping/tabs.ts の TabsApi とは分けてある（design.md）
 */
export interface SuspendTabsApi {
  /** 操作対象のウィンドウ（通常は popup を開いたウィンドウ）に存在するタブグループと、それぞれのタブを返す */
  queryWindowGroups: () => Promise<SuspendTabGroup[]>;
  /** 指定したタブをサスペンド（discard）する */
  discardTabs: (tabIds: readonly number[]) => Promise<void>;
}
