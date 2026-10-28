import { expect } from "@playwright/test";
import type { Worker } from "@playwright/test";

/** 初回インストール時に投入されるサンプルルールの件数（utils/rules/seed.ts） */
const SAMPLE_RULE_COUNT = 3;

/** background が記録した、ルールが持っているグループのタイトル（ルールの ID から） */
export async function storedTitles(serviceWorker: Worker): Promise<Record<string, string>> {
  return serviceWorker.evaluate(async () => {
    const { ruleGroupTitles } = await chrome.storage.local.get<{ ruleGroupTitles?: Record<string, string> }>(
      "ruleGroupTitles",
    );
    return ruleGroupTitles ?? {};
  });
}

/**
 * E2E は毎回新しいプロフィールで拡張機能を読み込むため、必ず `reason: "install"` になり、
 * background がサンプルルール3件の投入とその反映（regroupAll によるタイトルの記録）を行う。
 * これがテストの操作（setRules 等）とレースしないよう、先に完了を待つ。
 *
 * @param serviceWorker - 待つ対象の background の Service Worker
 * @returns serviceWorker をそのまま返す
 * @remarks 反映が終わると、サンプルルール3件分のタイトルが ruleGroupTitles に記録される
 */
export async function waitForFirstInstallSettled(serviceWorker: Worker): Promise<Worker> {
  await expect
    .poll(async () => Object.keys(await storedTitles(serviceWorker)).length)
    .toBeGreaterThanOrEqual(SAMPLE_RULE_COUNT);
  return serviceWorker;
}
