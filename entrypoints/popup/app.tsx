import type { JSX } from "preact";

import { RuleSettings } from "../../components/rule-settings/rule-settings";
import { RULES_ITEM, RULE_TITLES_ITEM, createRuleTitlesStore, createRulesStore } from "../../utils/rules/storage";
import { defineStorageItem } from "../platform/storage";

const rulesStore = createRulesStore(defineStorageItem(RULES_ITEM));
const titlesStore = createRuleTitlesStore(defineStorageItem(RULE_TITLES_ITEM));

export function App(): JSX.Element {
  return (
    <main class="page">
      <h1 class="page__title">TabHerd</h1>
      <RuleSettings store={rulesStore} titlesStore={titlesStore} />
    </main>
  );
}
