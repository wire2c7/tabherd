import { expect, test } from "./fixtures";
import type { Rule } from "../utils/rules/types";

// テストの名前は openspec/specs/auto-grouping/spec.md「タブの判定とグループ化」の
// タイトル関連の Scenario に対応させる（ファイルを分けるのは auto-grouping.e2e.ts の行数のため）

/** タイトルを対象にした部分一致の条件を持つルール */
const review: Rule = {
  id: "review",
  name: "レビュー",
  color: "orange",
  conditions: [{ target: "title", type: "contains", value: "Pull Request" }],
};

test.describe("タブの判定とグループ化", () => {
  test("タイトルが変わったタブ", async ({ setRules, groupOf, openTab }) => {
    await setRules([review]);
    const page = await openTab("/other/1");
    await expect.poll(async () => groupOf("/other/1")).toBeNull();

    await page.evaluate(() => {
      document.title = "Add feature · Pull Request #1";
    });

    await expect.poll(async () => groupOf("/other/1")).toMatchObject({ title: "レビュー", color: "orange" });
  });

  test("タイトルが短い間隔で何度も変わる", async ({ setRules, groupOf, openTab }) => {
    await setRules([review]);
    const page = await openTab("/other/2");

    await page.evaluate(() => {
      document.title = "読み込み中";
    });
    await page.evaluate(() => {
      document.title = "読み込み中 (2)";
    });
    await page.evaluate(() => {
      document.title = "Add feature · Pull Request #2";
    });

    await expect.poll(async () => groupOf("/other/2")).toMatchObject({ title: "レビュー" });
  });
});
