import type { GroupColor } from "../rules/types";

/** 計画に使うタブの情報 */
export interface TabSnapshot {
  id: number;
  url: string;
  pinned: boolean;
  /** 所属するタブグループの ID。どのグループにも入っていなければ -1（tabGroups.TAB_GROUP_ID_NONE） */
  groupId: number;
}

/** 計画に使うタブグループの情報 */
export interface GroupSnapshot {
  id: number;
  title: string;
  color: GroupColor;
}

/** 1つのウィンドウのスナップショット */
export interface WindowSnapshot {
  id: number;
  /** タブバーの左から順に並べる。同名のグループのうち左のものを選ぶのに使う */
  tabs: TabSnapshot[];
  groups: GroupSnapshot[];
}

/** 1つ以上のタブの ID（tabs.group・tabs.ungroup の引数の型に合わせる） */
export type TabIds = [number, ...number[]];

/** グループ操作の計画の1手順 */
export type GroupOperation =
  /** 既存のグループへ入れる */
  | { type: "add-to-group"; groupId: number; tabIds: TabIds }
  /** 新しいグループを作って入れ、タイトル・色を付ける */
  | { type: "create-group"; windowId: number; title: string; color: GroupColor; tabIds: TabIds }
  /** グループから外す */
  | { type: "ungroup"; tabIds: TabIds }
  /** グループのタイトル・色を変える */
  | { type: "update-group"; groupId: number; title: string; color: GroupColor }
  /** グループを、先頭のタブが index の位置に来るよう移動する */
  | { type: "move-group"; groupId: number; index: number };
