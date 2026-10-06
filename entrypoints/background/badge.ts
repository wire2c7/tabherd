import { browser } from "wxt/browser";

import type { RulesState } from "../../utils/grouping/regroup";
import { countUnusedRules } from "../../utils/rules/match";

/**
 * manifest のアイコンの説明を返す。
 *
 * @returns WXT が popup の title から作る manifest のアイコンの説明。無ければ拡張機能の名前
 */
function defaultTitle(): string {
  const manifest = browser.runtime.getManifest();
  return (manifest.manifest_version === 3 ? manifest.action?.default_title : undefined) ?? manifest.name;
}

/**
 * 使われないルールがあれば、拡張機能のアイコンにバッジ「!」を付け、説明に件数を出す。無ければバッジを消し、説明を manifest のものに戻す。
 *
 * @param state - 判定対象のルールの一覧と、ルールが持っているグループのタイトル
 * @remarks バッジは件数にしない（タブの数等と取り違えないため）
 */
export async function showUnusedRules({ rules, titles }: RulesState): Promise<void> {
  const count = countUnusedRules(rules, titles);
  const title = defaultTitle();
  await Promise.all([
    browser.action.setBadgeText({ text: count > 0 ? "!" : "" }),
    browser.action.setTitle({
      title: count > 0 ? `${title}（使われないルールが ${count} 件あります）` : title,
    }),
  ]);
}
