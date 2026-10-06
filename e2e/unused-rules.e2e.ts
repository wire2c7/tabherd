import type { Worker } from "@playwright/test";

import { expect, rule, test } from "./fixtures";
import { storedTitles } from "./rule-titles";

// テストの名前は openspec/specs/rule-settings-ui/spec.md の「使われないルールの通知」の Scenario に対応させる

const dev = rule("dev", "開発", "blue");
const docs = rule("docs", "資料", "green");

/** 拡張機能のアイコンのバッジと説明。background がルールの変更を反映した後に更新される */
async function badgeOf(serviceWorker: Worker): Promise<{ text: string; title: string }> {
  return serviceWorker.evaluate(async () => ({
    text: await chrome.action.getBadgeText({}),
    title: await chrome.action.getTitle({}),
  }));
}

// 名前が空のルールは、グループのタイトルを持っているときだけ数えるため、記録が書かれてから名前を消す
test.describe("使われないルールの通知", () => {
  test("使われないルールがある", async ({ serviceWorker, setRules, openSettings }) => {
    await setRules([dev, docs]);
    await expect.poll(async () => storedTitles(serviceWorker)).toStrictEqual({ dev: "開発", docs: "資料" });
    const page = await openSettings("options");

    await page.getByLabel("グループ名").nth(1).clear();

    await expect(page.getByText("使われないルールが 1 件あります", { exact: false })).toBeVisible();
    await expect
      .poll(async () => badgeOf(serviceWorker))
      .toStrictEqual({ text: "!", title: "TabHerd（使われないルールが 1 件あります）" });
  });

  test("使われないルールが無くなる", async ({ serviceWorker, setRules, openSettings }) => {
    await setRules([dev, docs]);
    await expect.poll(async () => storedTitles(serviceWorker)).toStrictEqual({ dev: "開発", docs: "資料" });
    const page = await openSettings("options");
    const notice = page.getByText("使われないルールが 1 件あります", { exact: false });
    await page.getByLabel("グループ名").nth(1).clear();
    await expect(notice).toBeVisible();
    await expect.poll(async () => badgeOf(serviceWorker)).toMatchObject({ text: "!" });

    await page.getByLabel("グループ名").nth(1).fill("資料");

    await expect(notice).toBeHidden();
    await expect.poll(async () => badgeOf(serviceWorker)).toStrictEqual({ text: "", title: "TabHerd" });
  });

  test("ルールを追加した直後", async ({ serviceWorker, setRules, openSettings }) => {
    await setRules([dev]);
    await expect.poll(async () => storedTitles(serviceWorker)).toStrictEqual({ dev: "開発" });
    const page = await openSettings("options");

    await page.getByRole("button", { name: "＋ ルールを追加" }).click();

    await expect(page.getByText("グループ名を入力してください")).toBeVisible();
    await expect(page.getByText("使われないルールが", { exact: false })).toBeHidden();
  });
});
