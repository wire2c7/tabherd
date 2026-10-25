import type { JSX } from "preact";

import { RuleSettings } from "../../components/rule-settings/rule-settings";
import { SuspendGroups } from "../../components/suspend-groups/suspend-groups";
import { RULES_ITEM, RULE_TITLES_ITEM, createRuleTitlesStore, createRulesStore } from "../../utils/rules/storage";
import { SUSPEND_CONFIRM_ITEM, createSuspendConfirmStore } from "../../utils/suspend/settings";
import { defineStorageItem } from "../platform/storage";
import { browserSuspendTabs } from "../platform/suspend-tabs";

const rulesStore = createRulesStore(defineStorageItem(RULES_ITEM));
const titlesStore = createRuleTitlesStore(defineStorageItem(RULE_TITLES_ITEM));
const suspendConfirmStore = createSuspendConfirmStore(defineStorageItem(SUSPEND_CONFIRM_ITEM));

/**
 * ポップアップの画面。
 *
 * @returns タブグループの一覧・サスペンド操作とルールの設定を表示するページ
 */
export function App(): JSX.Element {
  return (
    <main class="page">
      <h1 class="page__title">TabHerd</h1>
      <SuspendGroups api={browserSuspendTabs} confirmStore={suspendConfirmStore} />
      <RuleSettings store={rulesStore} titlesStore={titlesStore} />
    </main>
  );
}
