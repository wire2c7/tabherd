import { expect, rule, test } from "./fixtures";

// テストの名前は openspec/specs/auto-grouping/spec.md の「タブバー上のグループの並び」の Scenario に対応させる。
// 「何も起きない」ことの確かめ方は auto-grouping.e2e.ts と同じ

const dev = rule("dev", "開発", "blue");
const work = rule("work", "業務", "red");

test.describe("タブバー上のグループの並び", () => {
  test("ルールの順に並ぶ", async ({ setRules, groupOrders, openTab }) => {
    await setRules([work, dev]);

    // 先に「開発」のグループを作り、その右に「業務」のグループを作らせる
    await openTab("/dev/1");
    await expect.poll(async () => groupOrders()).toStrictEqual([["開発"]]);
    await openTab("/work/1");

    await expect.poll(async () => groupOrders()).toStrictEqual([["業務", "開発"]]);
  });

  test("ルールの順番を変える", async ({ setRules, groupOrders, openTab }) => {
    // 「ルールの変更の反映」と同じく、最初のルールの保存が反映されてから順番を変える
    await openTab("/dev/1");
    await openTab("/work/1");
    await setRules([work, dev]);
    await expect.poll(async () => groupOrders()).toStrictEqual([["業務", "開発"]]);

    await setRules([dev, work]);

    await expect.poll(async () => groupOrders()).toStrictEqual([["開発", "業務"]]);
  });

  test("ピン留めされたタブがある", async ({ serviceWorker, setRules, tabIdOf, tabLayouts, openTab }) => {
    await setRules([dev]);
    await openTab("/other/pinned");
    await serviceWorker.evaluate(
      async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      },
      await tabIdOf("/other/pinned"),
    );

    await openTab("/dev/1");

    // 最初から開いている about:blank のタブ（グループに入っていない）より左、ピン留めされたタブの直後に並ぶ
    await expect.poll(async () => tabLayouts()).toStrictEqual([["/other/pinned", "[開発] /dev/1", "about:blank"]]);
  });

  test("管理対象でないタブ・グループがある", async ({ setRules, tabIdOf, tabLayouts, openTab, groupTabsManually }) => {
    await setRules([dev]);
    await openTab("/other/loose");
    await openTab("/other/manual");
    await groupTabsManually([await tabIdOf("/other/manual")], "手動");

    await openTab("/dev/1");

    await expect
      .poll(async () => tabLayouts())
      .toStrictEqual([["[開発] /dev/1", "about:blank", "/other/loose", "[手動] /other/manual"]]);
  });

  test("並びがすでに正しい", async ({ serviceWorker, setRules, groupOf, groupOrders, openTab }) => {
    await setRules([work, dev]);
    await openTab("/work/1");
    await openTab("/dev/1");
    await expect.poll(async () => groupOrders()).toStrictEqual([["業務", "開発"]]);

    // ここからの chrome.tabGroups.move の呼び出しを Service Worker で記録する。
    // 同じ位置への移動では onMoved が来ないため、イベントではなく呼び出しを数える
    await serviceWorker.evaluate(() => {
      const moves: number[] = [];
      Reflect.set(globalThis, "e2eGroupMoves", moves);
      const move = chrome.tabGroups.move.bind(chrome.tabGroups);
      chrome.tabGroups.move = async (groupId, moveProperties) => {
        moves.push(groupId);
        return move(groupId, moveProperties);
      };
    });
    await openTab("/dev/2");
    await expect.poll(async () => groupOf("/dev/2")).toMatchObject({ title: "開発" });
    await openTab("/dev/3");
    await expect.poll(async () => groupOf("/dev/3")).toMatchObject({ title: "開発" });

    expect(await serviceWorker.evaluate(() => Reflect.get(globalThis, "e2eGroupMoves") as unknown)).toStrictEqual([]);
  });
});
