import { describe, expect, it } from "vitest";

import type { Rule } from "../../rules/types";
import { planGroupOrder } from "../order";
import { TAB_GROUP_ID_NONE } from "../plan";
import type { GroupOperation, GroupSnapshot, TabSnapshot, WindowSnapshot } from "../types";
import { applyOperations } from "./model";

// 例のテスト用の、条件を持たないルール・グループに入っていないかグループのタブ・グループ
function exampleRule(name: string): Rule {
  return { id: name, name, color: "blue", conditions: [] };
}

function exampleTab(id: number, groupId = TAB_GROUP_ID_NONE): TabSnapshot {
  return { id, url: `https://example.com/${id}`, pinned: false, groupId };
}

function exampleGroup(id: number, title: string): GroupSnapshot {
  return { id, title, color: "grey" };
}

function tabIdsOf(window: WindowSnapshot): number[] {
  return window.tabs.map(({ id }) => id);
}

describe("並べ替えの計画の適用", () => {
  it("order.test.ts の例の計画を適用すると、管理対象のグループがルールの順に並ぶ", () => {
    const groups = [exampleGroup(100, "開発"), exampleGroup(200, "業務"), exampleGroup(900, "手動")];
    const window: WindowSnapshot = {
      id: 1,
      tabs: [
        exampleTab(1),
        exampleTab(2, 900),
        exampleTab(3, 100),
        exampleTab(4, 100),
        exampleTab(5),
        exampleTab(6, 200),
      ],
      groups,
    };
    const operations = planGroupOrder(window, [exampleRule("開発"), exampleRule("業務")]);
    expect(tabIdsOf(applyOperations(window, operations))).toStrictEqual([3, 4, 6, 1, 2, 5]);
  });

  it("同名のグループが複数あるときは、今の左右の順のまま続けて並ぶ", () => {
    const groups = [exampleGroup(100, "開発"), exampleGroup(101, "開発"), exampleGroup(200, "業務")];
    const window: WindowSnapshot = {
      id: 1,
      tabs: [exampleTab(1, 100), exampleTab(2, 200), exampleTab(3, 101)],
      groups,
    };
    const operations = planGroupOrder(window, [exampleRule("開発"), exampleRule("業務")]);
    expect(tabIdsOf(applyOperations(window, operations))).toStrictEqual([1, 3, 2]);
  });

  it("グループを右へ動かす操作は受け付けない", () => {
    const window: WindowSnapshot = {
      id: 1,
      tabs: [exampleTab(1, 100), exampleTab(2)],
      groups: [exampleGroup(100, "開発")],
    };
    expect(() => applyOperations(window, [{ type: "move-group", groupId: 100, index: 1 }])).toThrow(Error);
  });
});

describe("グループに入れる・外す計画の適用", () => {
  it("グループから外してタブが無くなったグループは、一覧から消える", () => {
    const window: WindowSnapshot = { id: 1, tabs: [exampleTab(1, 100)], groups: [exampleGroup(100, "開発")] };
    expect(applyOperations(window, [{ type: "ungroup", tabIds: [1] }])).toStrictEqual({
      id: 1,
      tabs: [exampleTab(1)],
      groups: [],
    });
  });

  it("無くなったグループへ入れる操作は、Chrome と同じく失敗して何も変えない", () => {
    const window: WindowSnapshot = {
      id: 1,
      tabs: [exampleTab(1, 100), exampleTab(2)],
      groups: [exampleGroup(100, "開発")],
    };
    const operations: GroupOperation[] = [
      { type: "ungroup", tabIds: [1] },
      { type: "add-to-group", groupId: 100, tabIds: [2] },
    ];
    expect(applyOperations(window, operations)).toStrictEqual({
      id: 1,
      tabs: [exampleTab(1), exampleTab(2)],
      groups: [],
    });
  });

  it("新しいグループを作ると、既存のグループと重ならない ID でタブが入る", () => {
    const window: WindowSnapshot = {
      id: 1,
      tabs: [exampleTab(1, 100), exampleTab(2)],
      groups: [exampleGroup(100, "開発")],
    };
    const operation: GroupOperation = { type: "create-group", windowId: 1, title: "業務", color: "red", tabIds: [2] };
    expect(applyOperations(window, [operation])).toStrictEqual({
      id: 1,
      tabs: [exampleTab(1, 100), exampleTab(2, 101)],
      groups: [exampleGroup(100, "開発"), { id: 101, title: "業務", color: "red" }],
    });
  });
});
