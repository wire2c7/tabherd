import { defineBackground } from "wxt/utils/define-background";

import { createSerialQueue } from "../../utils/grouping/serial";
import { configureLogging } from "../../utils/logging/setup";
import { LOGS_ITEM } from "../../utils/logging/storage";
import { defineStorageItem } from "../platform/storage";
import { refreshUnusedRulesBadge, regroupOnEvents } from "./grouping";
import { handleLogsRequests, logUncaughtErrors } from "./logs";

export default defineBackground(() => {
  const storedLogs = configureLogging({ dev: import.meta.env.DEV, logs: defineStorageItem(LOGS_ITEM) });
  logUncaughtErrors();
  handleLogsRequests(storedLogs);

  // グループを作ってからタイトルを付けるまでに別のイベントを処理すると同名のグループが2つできるため、処理を直列にする。
  // 各処理は開始時にルールとスナップショットを読み直す
  const enqueue = createSerialQueue();
  regroupOnEvents(enqueue);
  void enqueue(refreshUnusedRulesBadge);
});
