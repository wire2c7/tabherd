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
 * @remarks 対象タブが0件なら何もしない（確認も出さない）。確認表示設定が有効なとき、確認で中止を選ぶと discardTabs を呼ばない
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
  await deps.api.discardTabs(group.targetTabIds);
}
