import { describe, expect, it } from "vitest";

import type { Rule } from "../rules/types";
import { planGroupOrder } from "./order";
import { TAB_GROUP_ID_NONE } from "./plan";
import type { GroupSnapshot, TabSnapshot, WindowSnapshot } from "./types";

function rule(name: string): Rule {
  return { id: name, name, color: "blue", conditions: [] };
}

const WORK = rule("業務");
const DEV = rule("開発");

function tab(id: number, groupId = TAB_GROUP_ID_NONE): TabSnapshot {
  return { id, url: `https://example.com/${id}`, pinned: false, groupId };
}

function group(id: number, title: string): GroupSnapshot {
  return { id, title, color: "grey" };
}

function windowOf(tabs: TabSnapshot[], groups: GroupSnapshot[]): WindowSnapshot {
  return { id: 1, tabs, groups };
}

const GROUPS = [group(100, "開発"), group(200, "業務"), group(900, "手動")];

describe("タブバー上のグループの並び", () => {
  it("管理対象のグループをルールの順に並べる", () => {
    // 前提/検証: 開発(100)・業務(200)の順のタブに [業務, 開発] を渡すと、業務(200)を先頭へ動かす1操作が出る
    const window = windowOf([tab(1, 100), tab(2, 100), tab(3, 200)], GROUPS);
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([{ type: "move-group", groupId: 200, index: 0 }]);
  });

  it("ルールの順番を変えると、その順に並べ直す", () => {
    // 前提/検証: 業務(200)・開発(100)の順のタブに [開発, 業務] を渡すと、開発(100)を先頭へ動かす1操作が出る
    const window = windowOf([tab(1, 200), tab(2, 100), tab(3, 100)], GROUPS);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([{ type: "move-group", groupId: 100, index: 0 }]);
  });

  it("並びがすでに正しいときは移動しない", () => {
    // 前提/検証: 業務・開発の順にすでに並び、管理対象でないタブ・グループ(900)が混ざっていても、移動の操作は出ない
    const window = windowOf([tab(1, 200), tab(2, 100), tab(3), tab(4, 900)], GROUPS);
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([]);
  });

  it("ピン留めされたタブの直後から並べる", () => {
    // 前提/検証: 先頭の2枚のピン留めタブの後に開発(100)・業務(200)が逆順で並ぶとき、業務(200)を直後(index 2)へ動かす
    const pinned1 = { ...tab(1), pinned: true };
    const pinned2 = { ...tab(2), pinned: true };
    const window = windowOf([pinned1, pinned2, tab(3, 100), tab(4, 200)], GROUPS);
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([{ type: "move-group", groupId: 200, index: 2 }]);
  });

  it("管理対象のグループの前にある、管理対象でないタブ・グループを後ろへ押し出す", () => {
    // 前提/検証: 無管理(1)・手動(900,2)・開発(100,3,4)・無管理(5)・業務(200,6)の順を、開発→業務→元の相対順の残りに並べる2操作が出る
    const window = windowOf([tab(1), tab(2, 900), tab(3, 100), tab(4, 100), tab(5), tab(6, 200)], GROUPS);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([
      { type: "move-group", groupId: 100, index: 0 },
      { type: "move-group", groupId: 200, index: 2 },
    ]);
  });

  it("同名のグループが複数あるときは、今の左右の順のまま続けて並べる", () => {
    // 前提/検証: 同名「開発」のグループ(100,101)が離れて並ぶとき、左右の順のまま続けて並ぶよう101を index 1 へ動かす
    const groups = [group(100, "開発"), group(101, "開発"), group(200, "業務")];
    const window = windowOf([tab(1, 100), tab(2, 200), tab(3, 101)], groups);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([{ type: "move-group", groupId: 101, index: 1 }]);
  });

  it("管理対象でないグループと、無効なルールの名前のグループは動かさない", () => {
    // 前提/検証: 手動グループ(900)と名前が空のグループ(300)があっても、移動の操作は出ない
    const groups = [group(900, "手動"), group(300, "")];
    const window = windowOf([tab(1, 900), tab(2, 300)], groups);
    expect(planGroupOrder(window, [WORK, DEV, rule("")])).toStrictEqual([]);
  });
});

describe("無効なルールのグループの並び", () => {
  it("無効なルールが持ち続けるタイトルのグループは、そのルールの位置に置く", () => {
    // 前提: 開発ルールの名前を空にして無効化し、持ち続けたタイトル「開発」を記録(titles)として渡す
    // 検証: 無効なルールの位置（0番目）に、そのタイトルのグループ(100)を動かす1操作が出る
    const emptied: Rule = { ...DEV, name: "" };
    const window = windowOf([tab(1, 200), tab(2, 100)], GROUPS);
    expect(planGroupOrder(window, [emptied, WORK], new Map([[DEV.id, "開発"]]))).toStrictEqual([
      { type: "move-group", groupId: 100, index: 0 },
    ]);
  });
});
