import type { JSX } from "preact";
import { browser } from "wxt/browser";

import { LogSettings } from "../../components/log-settings/log-settings";
import { RuleSettings } from "../../components/rule-settings/rule-settings";
import type { LogsRequest } from "../../utils/logging/messages";
import { LOGS_ITEM } from "../../utils/logging/storage";
import { RULES_ITEM, createRulesStore } from "../../utils/rules/storage";
import { defineStorageItem } from "../platform/storage";

const rulesStore = createRulesStore(defineStorageItem(RULES_ITEM));
const logsItem = defineStorageItem(LOGS_ITEM);
const extensionVersion = browser.runtime.getManifest().version;

async function sendLogsRequest(message: LogsRequest): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}

export function App(): JSX.Element {
  return (
    <main class="page">
      <h1 class="page__title">TabHerd の設定</h1>
      <RuleSettings store={rulesStore} />
      <LogSettings logs={logsItem} send={sendLogsRequest} extensionVersion={extensionVersion} />
    </main>
  );
}
