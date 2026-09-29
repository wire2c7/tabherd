import type { JSX } from "preact";

import { RuleSettings } from "../../components/rule-settings/rule-settings";

export function App(): JSX.Element {
  return (
    <main class="page">
      <h1 class="page__title">TabHerd</h1>
      <RuleSettings />
    </main>
  );
}
