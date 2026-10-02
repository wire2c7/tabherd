import { browser } from "wxt/browser";

import { getAppLogger } from "../logging/setup";
import type { GroupOperation } from "./types";

const logger = getAppLogger("grouping");

/** ログに出す操作。グループ名は閲覧先を表しうるため、タイトル・色を除く */
export type LoggedOperation =
  | Exclude<GroupOperation, { type: "create-group" | "update-group" }>
  | { type: "create-group"; windowId: number; tabIds: readonly number[] }
  | { type: "update-group"; groupId: number };

/** 操作からログに出せる値だけを取り出す */
export function toLoggedOperation(operation: GroupOperation): LoggedOperation {
  switch (operation.type) {
    case "create-group": {
      return { type: operation.type, windowId: operation.windowId, tabIds: operation.tabIds };
    }
    case "update-group": {
      return { type: operation.type, groupId: operation.groupId };
    }
    case "add-to-group":
    case "ungroup":
    case "move-group": {
      return operation;
    }
    default: {
      return operation satisfies never;
    }
  }
}

/** ユーザーがタブをドラッグしているあいだ、タブ・グループの操作が失敗するときのエラーメッセージ */
const TABS_BUSY_MESSAGE = "Tabs cannot be edited right now";

/** タブの編集ができないときに、やり直すまで待つ時間（ミリ秒）。要素の数がやり直す回数 */
export const RETRY_DELAYS_MS: readonly number[] = [100, 200, 400, 800, 1600];

function isTabsBusyError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(TABS_BUSY_MESSAGE);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** action を実行し、タブの編集ができないエラーのときだけ RETRY_DELAYS_MS の時間を待ってやり直す */
export async function retryWhileTabsBusy<T>(action: () => Promise<T>, delays = RETRY_DELAYS_MS): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const [delay, ...restDelays] = delays;
    if (delay === undefined || !isTabsBusyError(error)) {
      throw error;
    }
    await sleep(delay);
    return retryWhileTabsBusy(action, restDelays);
  }
}

async function executeOperation(operation: GroupOperation): Promise<void> {
  switch (operation.type) {
    case "add-to-group": {
      await retryWhileTabsBusy(async () =>
        browser.tabs.group({ groupId: operation.groupId, tabIds: operation.tabIds }),
      );
      return;
    }
    case "create-group": {
      const groupId = await retryWhileTabsBusy(async () =>
        browser.tabs.group({ createProperties: { windowId: operation.windowId }, tabIds: operation.tabIds }),
      );
      await retryWhileTabsBusy(async () =>
        browser.tabGroups.update(groupId, { title: operation.title, color: operation.color }),
      );
      return;
    }
    case "ungroup": {
      await retryWhileTabsBusy(async () => browser.tabs.ungroup(operation.tabIds));
      return;
    }
    case "update-group": {
      await retryWhileTabsBusy(async () =>
        browser.tabGroups.update(operation.groupId, { title: operation.title, color: operation.color }),
      );
      return;
    }
    case "move-group": {
      await retryWhileTabsBusy(async () => browser.tabGroups.move(operation.groupId, { index: operation.index }));
      return;
    }
    default: {
      operation satisfies never;
    }
  }
}

/**
 * 計画の操作を順にブラウザの API で実行する。
 * 操作が失敗したら（スナップショットの後にタブが閉じられた等）ログに出し、残りの操作を続ける
 */
export async function executeOperations(operations: readonly GroupOperation[]): Promise<void> {
  for (const operation of operations) {
    try {
      logger.debug("操作 {operation} を実行します", { operation: toLoggedOperation(operation) });
      // 前の操作でタブの位置・グループが変わるため、順に実行する
      // oxlint-disable-next-line no-await-in-loop
      await executeOperation(operation);
    } catch (error) {
      logger.warning("グループの操作 {operation} に失敗しました", { operation: toLoggedOperation(operation), error });
    }
  }
}
