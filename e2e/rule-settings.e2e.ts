import type { SettingsPageName } from "./fixtures";
import { expect, rule, shownNames, test } from "./fixtures";

// テストの名前は openspec/specs/rule-settings-ui/spec.md の Requirement（describe）と Scenario（test）に対応させる。
// Scenario のない確認は、対応する Requirement の中に置く

const dev = rule("dev", "開発", "blue");
const docs = rule("docs", "資料", "green");

const pageNames: readonly SettingsPageName[] = ["popup", "options"];

test.describe("設定画面の表示場所", () => {
  test.fixme(
    "ポップアップから開く",
    {
      annotation: {
        type: "manual",
        description: [
          "Playwright からツールバーのアイコンのポップアップを開けないため、E2E テストでは popup.html をタブで開いて確かめている。本物のポップアップの大きさとスクロールは手で確かめる。",
          "1. `pnpm dev` で起動したブラウザで、ツールバーの TabHerd のアイコンをクリックする",
          "2. ポップアップにルールの一覧が表示され、幅がポップアップに収まって横にはみ出さないことを確かめる",
          "3. 「ルールを追加」でルールを増やし、ポップアップの高さ（最大 600px）を超えると、ルールの一覧だけが縦にスクロールし、「ルールを追加」のボタンが見えたままであることを確かめる",
        ].join("\n"),
      },
    },
    () => {
      // 手で確かめる手順は annotation を参照
    },
  );

  test("オプションページから開く", async ({ setRules, openSettings }) => {
    await setRules([dev, docs]);

    const options = await openSettings("options");
    const popup = await openSettings("popup");

    await expect.poll(async () => shownNames(options)).toStrictEqual(["開発", "資料"]);
    expect(await shownNames(options)).toStrictEqual(await shownNames(popup));
  });

  test("ポップアップの幅に収まり、ルールの一覧だけが縦にスクロールする", async ({ setRules, openSettings }) => {
    await setRules(Array.from({ length: 10 }, (_, index) => rule(`rule-${index}`, `ルール ${index}`, "grey")));

    const popup = await openSettings("popup");
    await expect(popup.getByLabel("グループ名")).toHaveCount(10);

    const size = await popup.evaluate(() => {
      const root = document.documentElement;
      const list = document.querySelector(".rule-settings__list");
      return {
        pageOverflowsX: root.scrollWidth > root.clientWidth,
        pageOverflowsY: root.scrollHeight > root.clientHeight,
        listScrolls: list !== null && list.scrollHeight > list.clientHeight,
      };
    });
    expect(size).toStrictEqual({ pageOverflowsX: false, pageOverflowsY: false, listScrolls: true });
    await expect(popup.getByRole("button", { name: "＋ ルールを追加" })).toBeInViewport();
  });
});

test.describe("ルールの一覧", () => {
  for (const name of pageNames) {
    test(`ルールがない（${name}）`, async ({ openSettings }) => {
      const page = await openSettings(name);

      await expect(page.getByText("ルールがありません。「ルールを追加」からルールを作ってください。")).toBeVisible();
      await expect(page.getByRole("button", { name: "＋ ルールを追加" })).toBeVisible();
    });
  }
});

test.describe("ルールの追加・編集・削除", () => {
  for (const name of pageNames) {
    test(`ルールを追加する（${name}）`, async ({ setRules, storedRules, openSettings }) => {
      await setRules([dev]);
      const page = await openSettings(name);

      await page.getByRole("button", { name: "＋ ルールを追加" }).click();

      const nameInput = page.getByLabel("グループ名").nth(1);
      await expect(nameInput).toBeFocused();
      await expect.poll(async () => storedRules()).toHaveLength(2);
      const [first, added] = await storedRules();
      expect(first).toStrictEqual(dev);
      expect(added?.name).toBe("");

      await nameInput.fill("資料");
      await page.getByRole("article", { name: "ルール「資料」" }).getByLabel("グループの色").selectOption("green");
      await page.getByRole("article", { name: "ルール「資料」" }).getByLabel("条件 1 の値").fill("/docs/");

      await expect.poll(async () => storedRules()).toStrictEqual([dev, { ...docs, id: added?.id }]);
    });
  }

  test("条件を追加する", async ({ setRules, storedRules, openSettings }) => {
    await setRules([dev]);
    const page = await openSettings("popup");

    await page.getByRole("button", { name: "＋ 条件を追加" }).click();
    await page.getByLabel("条件 2 の種類").selectOption("regex");
    await page.getByLabel("条件 2 の値").fill(String.raw`^http://127\.0\.0\.1:\d+/dev2/`);

    await expect
      .poll(async () => storedRules())
      .toMatchObject([
        {
          conditions: [
            { type: "contains", value: "/dev/" },
            { type: "regex", value: String.raw`^http://127\.0\.0\.1:\d+/dev2/` },
          ],
        },
      ]);
  });

  test("条件を削除する", async ({ setRules, storedRules, openSettings }) => {
    await setRules([
      {
        ...dev,
        conditions: [
          { type: "contains", value: "/dev/" },
          { type: "contains", value: "/develop/" },
        ],
      },
    ]);
    const page = await openSettings("popup");

    await page.getByRole("button", { name: "条件 1 を削除" }).click();

    await expect
      .poll(async () => storedRules())
      .toMatchObject([{ conditions: [{ type: "contains", value: "/develop/" }] }]);
    await expect(page.getByLabel("条件 1 の値")).toHaveValue("/develop/");
  });

  test("閉じて開き直す", async ({ setRules, storedRules, openSettings }) => {
    await setRules([dev]);
    const popup = await openSettings("popup");
    await popup.getByLabel("グループ名").fill("Dev");
    await popup.getByLabel("グループの色").selectOption("red");
    await expect.poll(async () => storedRules()).toMatchObject([{ name: "Dev", color: "red" }]);

    await popup.close();
    const reopened = await openSettings("popup");

    await expect(reopened.getByLabel("グループ名")).toHaveValue("Dev");
    await expect(reopened.getByLabel("グループの色")).toHaveValue("red");
  });

  test("ルールを削除する", async ({ setRules, storedRules, openSettings }) => {
    await setRules([dev, docs]);
    const page = await openSettings("popup");

    await page.getByRole("article", { name: "ルール「開発」" }).getByRole("button", { name: "ルールを削除" }).click();

    await expect(page.getByRole("article", { name: "ルール「開発」" })).toHaveCount(0);
    await expect.poll(async () => storedRules()).toStrictEqual([docs]);
  });

  test("ポップアップとオプションページの一方での変更が、開いているもう一方に反映される", async ({
    setRules,
    openSettings,
  }) => {
    await setRules([dev]);
    const popup = await openSettings("popup");
    const options = await openSettings("options");

    await options.getByLabel("グループ名").fill("Dev");
    await expect(popup.getByLabel("グループ名")).toHaveValue("Dev");

    await popup.getByLabel("グループ名").fill("開発");
    await expect(options.getByLabel("グループ名")).toHaveValue("開発");
  });

  test("続けて入力しても、入力中の文字が消えない", async ({ setRules, storedNames, openSettings }) => {
    await setRules([dev]);
    const page = await openSettings("popup");
    const nameInput = page.getByLabel("グループ名");

    // 1文字ごとに保存し、その通知（watch）を受け取る。前の文字の保存の通知が次の文字の入力より後に届き、
    // それで表示が古い値に戻ると後の文字が失われる。Playwright のキー入力は1文字ごとに往復するため通知より遅く、
    // この順番にならない。ページの中で1文字ごとにタスクを譲りながら input イベントを送り、通知が入力の合間に届くようにする
    await nameInput.clear();
    await nameInput.evaluate(async (input: HTMLInputElement, text) => {
      for (const char of text) {
        input.value += char;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }));
        // oxlint-disable-next-line no-await-in-loop -- 1文字ずつ順に入力する
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    }, "ドキュメントの資料");

    await expect.poll(async () => storedNames()).toStrictEqual(["ドキュメントの資料"]);
    await expect(nameInput).toHaveValue("ドキュメントの資料");
  });
});

test.describe("入力の検証", () => {
  test("不正な正規表現", async ({ setRules, storedRules, openSettings }) => {
    await setRules([{ ...dev, conditions: [{ type: "regex", value: "" }] }]);
    const page = await openSettings("popup");
    const condition = page.getByRole("listitem").filter({ has: page.getByLabel("条件 1 の値") });
    const error = condition.getByText("正規表現の構文が正しくありません");

    // 値が空の正規表現は入力途中でもあるため、エラーにしない
    await expect(condition.getByLabel("条件 1 の種類")).toHaveValue("regex");
    await expect(error).toBeHidden();

    await condition.getByLabel("条件 1 の値").fill("(");
    await expect(error).toBeVisible();
    // エラーがあっても入力内容は保存する
    await expect.poll(async () => storedRules()).toMatchObject([{ conditions: [{ type: "regex", value: "(" }] }]);

    await condition.getByLabel("条件 1 の値").fill("^http");
    await expect(error).toBeHidden();
  });

  test("グループ名の重複", async ({ setRules, openSettings }) => {
    await setRules([dev, docs]);
    const page = await openSettings("popup");
    const message = "上のルールと同じグループ名です。このルールは使われません";

    await page.getByLabel("グループ名").nth(1).fill("開発");

    const [first, second] = [page.locator(".rule-settings__item").nth(0), page.locator(".rule-settings__item").nth(1)];
    await expect(second.getByText(message)).toBeVisible();
    await expect(first.getByText(message)).toBeHidden();
  });

  test("空のグループ名", async ({ setRules, storedNames, openSettings }) => {
    await setRules([dev]);
    const page = await openSettings("popup");
    const error = page.getByText("グループ名を入力してください");
    await expect(error).toBeHidden();

    await page.getByLabel("グループ名").clear();

    await expect(error).toBeVisible();
    await expect.poll(async () => storedNames()).toStrictEqual([""]);
  });
});
