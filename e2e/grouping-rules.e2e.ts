import { expect, rule, test } from "./logging-fixtures";

// テストの名前は openspec/specs/grouping-rules/spec.md の Requirement（describe）と Scenario（test）に対応させる。
// ルールの内容と一致の判定は単体テスト（utils/rules/*.test.ts）で確かめ、ここではバックグラウンドの処理を通して確かめる

const dev = rule("dev", "開発", "blue");
const docs = rule("docs", "資料", "green");

/** 条件の一覧が壊れた「開発」のルール */
const brokenDev = { ...dev, conditions: null };

test.describe("保存されたルールの読み込み", () => {
  test("条件の一覧が壊れている", async ({ setStoredRules, groupOf, openTab }) => {
    await setStoredRules([brokenDev, docs]);

    await openTab("/docs/1");
    await openTab("/dev/1");

    await expect.poll(async () => groupOf("/docs/1")).toMatchObject({ title: "資料", color: "green" });
    // 「開発」は条件なしとして扱い、どのタブも入れない。「資料」のタブより後に開いたタブの処理も終わってから確かめる
    await openTab("/docs/2");
    await expect.poll(async () => groupOf("/docs/2")).toMatchObject({ title: "資料" });
    expect(await groupOf("/dev/1")).toBeNull();
  });

  test("壊れた値を読み続ける", async ({ setStoredRules, storedLogs, groupOf, openTab }) => {
    // インストール時の判定し直しが、壊れた値を保存する前の（壊れていない）値を読み終えてから始める。
    // 後から届くと、壊れていない値を読んだとして、次に壊れた値を読んだときにもう一度警告する
    await setStoredRules([docs]);
    await openTab("/docs/0");
    await expect.poll(async () => groupOf("/docs/0")).toMatchObject({ title: "資料" });
    await setStoredRules([brokenDev, docs]);

    // タブを開くたびに、バックグラウンドの処理がルールを読む
    await openTab("/docs/1");
    await expect.poll(async () => groupOf("/docs/1")).toMatchObject({ title: "資料" });
    await openTab("/docs/2");
    await expect.poll(async () => groupOf("/docs/2")).toMatchObject({ title: "資料" });

    const logs = await storedLogs();
    const warnings = logs.filter((log) => log.level === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.properties).toStrictEqual({ notArray: false, droppedRules: 0, repairedRules: 1 });
  });
});
