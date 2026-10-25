import { pickSuspendTargets } from "../../utils/suspend/plan";
import type { SuspendTabGroup } from "../../utils/suspend/tabs";

/** 一覧に表示する「名前が無いグループ」のタイトル */
const UNTITLED_GROUP_TITLE = "名前なしのグループ";

/** 一覧に表示する1件分のグループの情報 */
export interface GroupView {
  id: number;
  /** 空のときは UNTITLED_GROUP_TITLE を使う */
  title: string;
  color: SuspendTabGroup["color"];
  tabCount: number;
  /** サスペンド対象のタブ ID（アクティブタブ・ピン留めタブを除く） */
  targetTabIds: number[];
}

/**
 * SuspendTabGroup の一覧から、一覧に表示する情報を組み立てる。
 *
 * @param groups - ウィンドウのタブグループの一覧
 * @returns 表示用の GroupView の一覧（groups と同じ順）
 * @remarks タイトルの無いグループ（ブラウザの機能で手動作成したグループ等）には UNTITLED_GROUP_TITLE を表示する
 */
export function buildGroupViews(groups: readonly SuspendTabGroup[]): GroupView[] {
  return groups.map((group) => ({
    id: group.id,
    title: group.title !== undefined && group.title.length > 0 ? group.title : UNTITLED_GROUP_TITLE,
    color: group.color,
    tabCount: group.tabs.length,
    targetTabIds: pickSuspendTargets(group.tabs),
  }));
}
