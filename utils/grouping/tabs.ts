import type { GroupColor } from "../rules/types";
import type { TabIds } from "./types";

/** ブラウザのタブ（tabs.Tab のうち、グループ化に使うもの） */
export interface BrowserTab {
  /** 開発者ツール等のタブは ID を持たない */
  id?: number | undefined;
  windowId: number;
  /** タブバーでの位置 */
  index: number;
  url?: string | undefined;
  pinned: boolean;
  /** 所属するタブグループの ID。どのグループにも入っていなければ -1 */
  groupId: number;
}

/** ブラウザのタブグループ（tabGroups.TabGroup のうち、グループ化に使うもの） */
export interface BrowserTabGroup {
  id: number;
  windowId: number;
  title?: string | undefined;
  color: GroupColor;
}

/** グループ化に使う、ブラウザのタブ・タブグループの API。WXT による実装は entrypoints/platform/tabs.ts */
export interface TabsApi {
  /** 通常のウィンドウのタブを返す。windowId を省略すると、すべての通常のウィンドウを対象にする */
  queryTabs: (windowId?: number) => Promise<BrowserTab[]>;
  /** タブグループを返す。windowId を省略すると、すべてのウィンドウを対象にする */
  queryGroups: (windowId?: number) => Promise<BrowserTabGroup[]>;
  /** タブを既存のグループ（groupId）か、ウィンドウ（windowId）に新しく作ったグループへ入れ、グループの ID を返す */
  group: (tabIds: TabIds, target: { groupId: number } | { windowId: number }) => Promise<number>;
  /** タブをグループから外す */
  ungroup: (tabIds: TabIds) => Promise<void>;
  /** グループのタイトル・色を変える */
  updateGroup: (groupId: number, properties: { title: string; color: GroupColor }) => Promise<void>;
  /** グループを、先頭のタブが index の位置に来るよう移動する */
  moveGroup: (groupId: number, index: number) => Promise<void>;
}
