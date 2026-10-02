import type { JSX } from "preact";

import { LogSettings } from "../../components/log-settings/log-settings";
import { RuleSettings } from "../../components/rule-settings/rule-settings";

export function App(): JSX.Element {
  return (
    <main class="page">
      <h1 class="page__title">TabHerd の設定</h1>
      <RuleSettings />
      <LogSettings />
    </main>
  );
}
