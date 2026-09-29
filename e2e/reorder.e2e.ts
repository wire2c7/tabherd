import { expect, rule, shownNames, test } from "./fixtures";

// テストの名前は openspec/specs/rule-settings-ui/spec.md の「ルールの並び替え」と、
// openspec/specs/auto-grouping/spec.md の「タブバー上のグループの並び」の Scenario に対応させる

const dev = rule("dev", "開発", "blue");
const docs = rule("docs", "資料", "green");
const work = rule("work", "業務", "red");

// oxlint-disable-next-line eslint/max-lines-per-function -- describe は Spec の Requirement ごとにテストをまとめるもので、行数で分けると Spec との対応が崩れる
test.describe("ルールの並び替え", () => {
  test("ドラッグで並び替える", async ({ setRules, storedNames, openSettings }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");
    const items = page.locator(".rule-settings__item");

    // 2番目のルールのハンドルを、1番目のルールの上端の近くへ落とす
    await items
      .nth(1)
      .locator(".drag-handle")
      .dragTo(items.nth(0), { targetPosition: { x: 20, y: 5 } });

    await expect.poll(async () => shownNames(page)).toStrictEqual(["資料", "開発", "業務"]);
    await expect.poll(async () => storedNames()).toStrictEqual(["資料", "開発", "業務"]);
  });

  test("ドラッグして元の位置に落とすと、並びは変わらない", async ({ setRules, openSettings }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");
    const items = page.locator(".rule-settings__item");
    const box = await items.nth(0).boundingBox();

    await items
      .nth(0)
      .locator(".drag-handle")
      .dragTo(items.nth(0), { targetPosition: { x: 20, y: (box?.height ?? 0) - 5 } });

    // 並びが変わらないドロップでは、ドロップ先の印（drop-before・drop-after）も付かない
    await expect(page.locator(".drop-before, .drop-after, .is-dragging")).toHaveCount(0);
    expect(await shownNames(page)).toStrictEqual(["開発", "資料", "業務"]);
  });

  test("入力欄の上に落としても、ルールの id が文字として貼り付かない", async ({
    setRules,
    storedNames,
    openSettings,
  }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");
    const items = page.locator(".rule-settings__item");

    await items.nth(2).locator(".drag-handle").dragTo(page.getByLabel("グループ名").nth(0));

    // グループ名の入力欄は1番目のルールの上半分にあるため、3番目のルールは1番目の上に入る。
    // グループ名に id（work）が貼り付いていれば、名前が変わって一致しない
    await expect.poll(async () => storedNames()).toStrictEqual(["業務", "開発", "資料"]);
    expect(await shownNames(page)).toStrictEqual(["業務", "開発", "資料"]);
  });

  test("キーボードで並び替える", async ({ setRules, storedNames, openSettings }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");

    await page.getByRole("button", { name: "「資料」を上へ移動" }).focus();
    await page.keyboard.press("Enter");

    await expect.poll(async () => shownNames(page)).toStrictEqual(["資料", "開発", "業務"]);
    await expect.poll(async () => storedNames()).toStrictEqual(["資料", "開発", "業務"]);

    // Space でも操作できる。先頭に着いて「上へ移動」が無効になったため、フォーカスは「下へ移動」にある
    await expect(page.getByRole("button", { name: "「資料」を下へ移動" })).toBeFocused();
    await page.keyboard.press("Space");

    await expect.poll(async () => storedNames()).toStrictEqual(["開発", "資料", "業務"]);
  });

  test("先頭と末尾のルール", async ({ setRules, openSettings }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");

    await expect(page.getByRole("button", { name: "「開発」を上へ移動" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "「開発」を下へ移動" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "「資料」を上へ移動" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "「資料」を下へ移動" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "「業務」を上へ移動" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "「業務」を下へ移動" })).toBeDisabled();
  });

  test("移動した後のフォーカス", async ({ setRules, openSettings }) => {
    await setRules([dev, docs, work]);
    const page = await openSettings("popup");

    await page.getByRole("button", { name: "「業務」を上へ移動" }).focus();
    await page.keyboard.press("Enter");

    await expect.poll(async () => shownNames(page)).toStrictEqual(["開発", "業務", "資料"]);
    await expect(page.getByRole("button", { name: "「業務」を上へ移動" })).toBeFocused();
  });
});

test.describe("タブバー上のグループの並び", () => {
  test("ルールの順番を変える（設定画面で並び替える）", async ({ setRules, openTab, groupOrders, openSettings }) => {
    await openTab("/dev/1");
    await openTab("/docs/1");
    await openTab("/work/1");
    await setRules([dev, docs, work]);
    await expect.poll(async () => groupOrders()).toStrictEqual([["開発", "資料", "業務"]]);
    const page = await openSettings("popup");

    const items = page.locator(".rule-settings__item");
    await items
      .nth(2)
      .locator(".drag-handle")
      .dragTo(items.nth(0), { targetPosition: { x: 20, y: 5 } });

    await expect.poll(async () => groupOrders()).toStrictEqual([["業務", "開発", "資料"]]);

    await page.getByRole("button", { name: "「資料」を上へ移動" }).click();

    await expect.poll(async () => groupOrders()).toStrictEqual([["業務", "資料", "開発"]]);
  });
});
