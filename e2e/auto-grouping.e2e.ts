import { expect, rule, test } from "./fixtures";

// テストの名前は openspec/specs/auto-grouping/spec.md の Requirement（describe）と Scenario（test）に対応させる。
// バックグラウンドはタブのイベントを直列に処理するため、「何も起きない」ことを確かめるときは、
// 後から別のタブを開き、それがグループに入るのを待ってから確かめる（前のイベントの処理も終わっている）

const dev = rule("dev", "開発", "blue");
const docs = rule("docs", "資料", "green");

test.describe("管理対象のグループ", () => {
  test("手動で作ったグループのタブ", async ({ setRules, tabIdOf, groupOf, openTab, groupTabsManually }) => {
    await setRules([dev]);
    const page = await openTab("/other/manual");
    const manualGroupId = await groupTabsManually([await tabIdOf("/other/manual")], "手動");

    await page.goto(new URL("/dev/in-manual", page.url()).href);
    await openTab("/dev/after");
    await expect.poll(async () => groupOf("/dev/after")).toMatchObject({ title: "開発" });

    expect(await groupOf("/dev/in-manual")).toMatchObject({ id: manualGroupId, title: "手動" });
  });

  test("別のウィンドウ", async ({ serviceWorker, server, setRules, findTab, groupOf, openTab }) => {
    await setRules([dev]);
    await openTab("/dev/a");
    await expect.poll(async () => groupOf("/dev/a")).toMatchObject({ title: "開発" });

    const windowB = await serviceWorker.evaluate(async (url) => {
      const window = await chrome.windows.create({ url });
      return window?.id;
    }, `${server.origin}/dev/b`);

    await expect.poll(async () => groupOf("/dev/b")).toMatchObject({ title: "開発" });
    const [tabA, tabB] = [await findTab("/dev/a"), await findTab("/dev/b")];
    expect(tabB?.windowId).toBe(windowB);
    expect(tabB?.group?.id).not.toBe(tabA?.group?.id);
  });

  test("同名のグループが複数ある", async ({ setRules, tabIdOf, groupOf, openTab, groupTabsManually }) => {
    // ルールより先に「開発」のグループを2つ作る。ルールの保存後の全体の判定し直しが終わったことは、
    // 同じく先に開いておいた /dev/probe がグループに入ることで分かる
    await openTab("/dev/left");
    await openTab("/dev/right");
    await openTab("/dev/probe");
    const leftGroupId = await groupTabsManually([await tabIdOf("/dev/left")], "開発");
    const rightGroupId = await groupTabsManually([await tabIdOf("/dev/right")], "開発");
    await setRules([dev]);
    await expect.poll(async () => groupOf("/dev/probe")).toMatchObject({ id: leftGroupId });

    await openTab("/dev/1");

    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ id: leftGroupId });
    expect(await groupOf("/dev/right")).toMatchObject({ id: rightGroupId });
  });
});

test.describe("タブの判定とグループ化", () => {
  test("新しく開いたタブ", async ({ setRules, groupOf, openTab }) => {
    await setRules([dev]);

    await openTab("/dev/1");

    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発", color: "blue" });
  });

  test("既存のグループに加わる", async ({ setRules, groupOf, groupOrders, openTab }) => {
    await setRules([dev]);
    await openTab("/dev/1");
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発" });
    const group = await groupOf("/dev/1");

    await openTab("/dev/2");

    await expect.poll(async () => groupOf("/dev/2")).toStrictEqual(group);
    expect(await groupOrders()).toStrictEqual([["開発"]]);
  });

  test("別のウィンドウへ移す", async ({ serviceWorker, setRules, findTab, tabIdOf, groupOf, openTab }) => {
    await setRules([dev]);
    await openTab("/dev/1");
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発" });

    const newWindowId = await serviceWorker.evaluate(
      async (tabId) => {
        const window = await chrome.windows.create({ tabId });
        return window?.id;
      },
      await tabIdOf("/dev/1"),
    );

    await expect.poll(async () => findTab("/dev/1")).toMatchObject({ windowId: newWindowId, group: { title: "開発" } });
  });
});

test.describe("一致しなくなったタブ", () => {
  test("別のルールに一致する URL へ移動する", async ({ setRules, groupOf, openTab }) => {
    await setRules([dev, docs]);
    const page = await openTab("/dev/1");
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発" });

    await page.goto(new URL("/docs/1", page.url()).href);

    await expect.poll(async () => groupOf("/docs/1")).toMatchObject({ title: "資料" });
  });

  test("どのルールにも一致しない URL へ移動する", async ({ setRules, groupOf, openTab }) => {
    await setRules([dev]);
    const page = await openTab("/dev/1");
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発" });

    await page.goto(new URL("/other/1", page.url()).href);

    await expect.poll(async () => groupOf("/other/1")).toBeNull();
  });
});

test.describe("対象外のタブ", () => {
  test("ピン留めされたタブ", async ({ serviceWorker, setRules, findTab, tabIdOf, groupOf, openTab }) => {
    await setRules([dev]);
    const page = await openTab("/other/pinned");
    await serviceWorker.evaluate(
      async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      },
      await tabIdOf("/other/pinned"),
    );

    await page.goto(new URL("/dev/pinned", page.url()).href);
    await openTab("/dev/after");
    await expect.poll(async () => groupOf("/dev/after")).toMatchObject({ title: "開発" });

    expect(await findTab("/dev/pinned")).toMatchObject({ pinned: true, group: null });
  });
});

test.describe("全体の判定し直し", () => {
  test("ルールを追加する", async ({ setRules, groupOf, openTab }) => {
    await openTab("/dev/1");
    await openTab("/dev/2");

    await setRules([dev]);

    await expect
      .poll(async () => Promise.all([groupOf("/dev/1"), groupOf("/dev/2")]))
      .toMatchObject([{ title: "開発" }, { title: "開発" }]);
  });
});

test.describe("ルールの変更の反映", () => {
  // ルールの変更は 300ms のデバウンスでまとめて反映され、その差分でグループのタイトル・色を変える。
  // 最初のルールの保存と次の変更がまとまらないよう、タブを先に開いておき、全体の判定し直しでグループに入るのを待ってから変える

  test("グループ名を変える", async ({ setRules, groupOf, openTab }) => {
    await openTab("/dev/1");
    await openTab("/dev/2");
    await setRules([dev]);
    await expect.poll(async () => groupOf("/dev/2")).toMatchObject({ title: "開発" });
    const group = await groupOf("/dev/1");

    await setRules([{ ...dev, name: "Dev" }]);

    const renamed = { ...group, title: "Dev" };
    await expect
      .poll(async () => Promise.all([groupOf("/dev/1"), groupOf("/dev/2")]))
      .toStrictEqual([renamed, renamed]);
  });

  test("色を変える", async ({ setRules, groupOf, openTab }) => {
    await openTab("/dev/1");
    await setRules([dev]);
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発", color: "blue" });
    const group = await groupOf("/dev/1");

    await setRules([{ ...dev, color: "red" }]);

    await expect.poll(async () => groupOf("/dev/1")).toStrictEqual({ ...group, color: "red" });
  });

  test("ルールを削除する", async ({ setRules, groupOf, openTab }) => {
    await openTab("/dev/1");
    await openTab("/docs/1");
    await setRules([dev, docs]);
    await expect
      .poll(async () => Promise.all([groupOf("/dev/1"), groupOf("/docs/1")]))
      .toMatchObject([{ title: "開発" }, { title: "資料" }]);

    await setRules([docs]);

    await expect
      .poll(async () => Promise.all([groupOf("/dev/1"), groupOf("/docs/1")]))
      .toMatchObject([null, { title: "資料" }]);
  });

  test("グループ名を空にする", async ({ setRules, groupOf, openTab }) => {
    await openTab("/dev/1");
    await setRules([dev]);
    await expect.poll(async () => groupOf("/dev/1")).toMatchObject({ title: "開発" });

    await setRules([{ ...dev, name: "" }]);

    await expect.poll(async () => groupOf("/dev/1")).toBeNull();
  });
});

test.fixme(
  "タブをドラッグしているあいだの操作のやり直し",
  {
    annotation: {
      type: "manual",
      description: [
        "Playwright からタブバーのタブをドラッグできず、ドラッグ中に Chrome がタブの操作を拒む状態（Tabs cannot be edited right now）を再現できないため、手で確かめる。",
        "1. `pnpm dev` で起動したブラウザで、ルール「開発」（部分一致 `github.com`）を作る",
        '2. `https://example.com/` 等のタブの DevTools のコンソールで `setTimeout(() => { location.href = "https://github.com/"; }, 3000)` を実行する',
        "3. 3秒以内に別のタブをタブバーの上でドラッグし始め、2 のタブの URL が変わるまで掴んだままにし、変わってから2秒以内に離す（やり直すのは合わせて約3秒）",
        "4. 2 のタブが「開発」のグループに入り、Service Worker のコンソールに「グループの操作に失敗しました」のエラーが出ていないことを確かめる",
      ].join("\n"),
    },
  },
  () => {
    // 手で確かめる手順は annotation を参照
  },
);
