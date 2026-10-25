import type { SuspendTab } from "./tabs";

/**
 * タブの一覧から、サスペンド対象のタブ ID を絞り込む。
 *
 * @param tabs - 絞り込み元のタブの一覧（通常は1つのタブグループに属するタブ）
 * @returns アクティブタブ・ピン留めタブを除いた、サスペンド対象のタブ ID
 * @remarks ID を持たないタブ（開発者ツール等）は対象にならない
 */
export function pickSuspendTargets(tabs: readonly SuspendTab[]): number[] {
  return tabs.flatMap((tab) => (tab.id !== undefined && !tab.pinned && !tab.active ? [tab.id] : []));
}
