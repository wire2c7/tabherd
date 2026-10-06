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
    const window = windowOf([tab(1, 100), tab(2, 100), tab(3, 200)], GROUPS);
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([{ type: "move-group", groupId: 200, index: 0 }]);
  });

  it("ルールの順番を変えると、その順に並べ直す", () => {
    const window = windowOf([tab(1, 200), tab(2, 100), tab(3, 100)], GROUPS);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([{ type: "move-group", groupId: 100, index: 0 }]);
  });

  it("並びがすでに正しいときは移動しない", () => {
    const window = windowOf([tab(1, 200), tab(2, 100), tab(3), tab(4, 900)], GROUPS);
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([]);
  });

  it("ピン留めされたタブの直後から並べる", () => {
    const window = windowOf(
      [{ ...tab(1), pinned: true }, { ...tab(2), pinned: true }, tab(3, 100), tab(4, 200)],
      GROUPS,
    );
    expect(planGroupOrder(window, [WORK, DEV])).toStrictEqual([{ type: "move-group", groupId: 200, index: 2 }]);
  });

  it("管理対象のグループの前にある、管理対象でないタブ・グループを後ろへ押し出す", () => {
    // 並べた後は 開発(3,4)・業務(6)・1・手動(2)・5 の順になり、管理対象でないものは元の相対的な順のまま
    const window = windowOf([tab(1), tab(2, 900), tab(3, 100), tab(4, 100), tab(5), tab(6, 200)], GROUPS);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([
      { type: "move-group", groupId: 100, index: 0 },
      { type: "move-group", groupId: 200, index: 2 },
    ]);
  });

  it("同名のグループが複数あるときは、今の左右の順のまま続けて並べる", () => {
    const groups = [group(100, "開発"), group(101, "開発"), group(200, "業務")];
    const window = windowOf([tab(1, 100), tab(2, 200), tab(3, 101)], groups);
    expect(planGroupOrder(window, [DEV, WORK])).toStrictEqual([{ type: "move-group", groupId: 101, index: 1 }]);
  });

  it("管理対象でないグループと、無効なルールの名前のグループは動かさない", () => {
    const groups = [group(900, "手動"), group(300, "")];
    const window = windowOf([tab(1, 900), tab(2, 300)], groups);
    expect(planGroupOrder(window, [WORK, DEV, rule("")])).toStrictEqual([]);
  });
});

describe("無効なルールのグループの並び", () => {
  it("無効なルールが持ち続けるタイトルのグループは、そのルールの位置に置く", () => {
    const emptied: Rule = { ...DEV, name: "" };
    const window = windowOf([tab(1, 200), tab(2, 100)], GROUPS);
    expect(planGroupOrder(window, [emptied, WORK], new Map([[DEV.id, "開発"]]))).toStrictEqual([
      { type: "move-group", groupId: 100, index: 0 },
    ]);
  });
});
