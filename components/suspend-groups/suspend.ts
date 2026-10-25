import { pickSuspendTargets } from "../../utils/suspend/plan";
import type { SuspendConfirmStore } from "../../utils/suspend/settings";
import type { SuspendTabsApi } from "../../utils/suspend/tabs";
import type { GroupView } from "./groups";

/** suspendGroup が使う依存先 */
export interface SuspendGroupDeps {
  /** discardTabs の呼び出し先 */
  api: SuspendTabsApi;
  /** 確認表示設定の読み先 */
  confirmStore: SuspendConfirmStore;
  /** 確認ダイアログの表示先。本体のコンポーネントからは window.confirm を渡す */
  confirm: (message: string) => boolean;
}

/**
 * グループのサスペンドを実行する。
 *
 * @param group - サスペンド対象のグループ（表示用情報）
 * @param deps - 確認表示設定・discard の実行・確認ダイアログの呼び出し先
 * @remarks 対象タブが0件なら何もしない（確認も出さない）。確認表示設定が有効なとき、確認で中止を選ぶと discardTabs を呼ばない。
 * 確認ダイアログの表示中にタブの状態（アクティブ化・ピン留め・終了）が変わっている場合があるため、discardTabs の直前に対象タブを数え直す
 */
export async function suspendGroup(group: GroupView, deps: SuspendGroupDeps): Promise<void> {
  if (group.targetTabIds.length === 0) {
    return;
  }
  const confirmEnabled = await deps.confirmStore.read();
  if (confirmEnabled) {
    const message = `「${group.title}」の${group.targetTabIds.length}件のタブをサスペンドします。よろしいですか？`;
    if (!deps.confirm(message)) {
      return;
    }
  }
  const currentTargetTabIds = await resolveCurrentTargetTabIds(group.id, deps.api);
  if (currentTargetTabIds.length === 0) {
    return;
  }
  await deps.api.discardTabs(currentTargetTabIds);
}

/** group.id のグループを問い合わせ直し、そのときの対象タブ ID を返す。グループが見つからなければ空配列を返す */
async function resolveCurrentTargetTabIds(groupId: number, api: SuspendTabsApi): Promise<number[]> {
  const groups = await api.queryWindowGroups();
  const current = groups.find((candidate) => candidate.id === groupId);
  return current === undefined ? [] : pickSuspendTargets(current.tabs);
}
