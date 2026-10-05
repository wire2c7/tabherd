import type { Worker } from "@playwright/test";

/** background が記録した、ルールが持っているグループのタイトル（ルールの ID から） */
export async function storedTitles(serviceWorker: Worker): Promise<Record<string, string>> {
  return serviceWorker.evaluate(async () => {
    const { ruleGroupTitles } = await chrome.storage.local.get<{ ruleGroupTitles?: Record<string, string> }>(
      "ruleGroupTitles",
    );
    return ruleGroupTitles ?? {};
  });
}
