import { assert, property, tuple } from "fast-check";
import { describe, expect, it } from "vitest";

import { validRules } from "../rules/match";
import type { Rule } from "../rules/types";
import { planGroupOrder } from "./order";
import { rulesArb, windowArb } from "./testing/arbitraries";
import { applyOperations } from "./testing/model";
import type { TabSnapshot, WindowSnapshot } from "./types";

const orderInputArb = tuple(windowArb, rulesArb);

/** 管理対象のグループのルールの順位。スナップショットに無いグループと、有効なルールの名前でないグループは管理対象でない */
function rankOf(window: WindowSnapshot, rules: readonly Rule[], tab: TabSnapshot): number | undefined {
  const title = window.groups.find((group) => group.id === tab.groupId)?.title;
  const rank = validRules(rules).findIndex((rule) => rule.name === title);
  return rank === -1 ? undefined : rank;
}

/**
 * 並べた後に期待するタブの ID の並び。ピン留めのタブ、管理対象のグループのタブ（ルールの順、同じ順位なら元の順）、
 * 残りのタブ（元の順）の順になる。グループのタブは連続しているため、タブを安定に並べ替えればグループの並べ替えになる
 */
function expectedTabIds(window: WindowSnapshot, rules: readonly Rule[]): number[] {
  const pinned = window.tabs.filter((tab) => tab.pinned);
  const unpinned = window.tabs.filter((tab) => !tab.pinned);
  const managed = unpinned
    .flatMap((tab) => {
      const rank = rankOf(window, rules, tab);
      return rank === undefined ? [] : [{ tab, rank }];
    })
    .toSorted((a, b) => a.rank - b.rank)
    .map(({ tab }) => tab);
  const others = unpinned.filter((tab) => rankOf(window, rules, tab) === undefined);
  return [...pinned, ...managed, ...others].map(({ id }) => id);
}

function arrange(window: WindowSnapshot, rules: readonly Rule[]): WindowSnapshot {
  return applyOperations(window, planGroupOrder(window, rules));
}

/** 移動の操作のうち、ピン留めのタブより左を指すものを返す（右への移動はモデルが例外にする） */
function movesIntoPinned(window: WindowSnapshot, rules: readonly Rule[]): unknown[] {
  const pinnedCount = window.tabs.filter((tab) => tab.pinned).length;
  return planGroupOrder(window, rules).filter(
    (operation) => operation.type !== "move-group" || operation.index < pinnedCount,
  );
}

function sortedById(tabs: readonly TabSnapshot[]): TabSnapshot[] {
  return tabs.toSorted((a, b) => a.id - b.id);
}

describe("planGroupOrder の性質", () => {
  it("計画を適用すると、ピン留めのタブの直後に管理対象のグループがルールの順に並び、残りは元の順のまま続く", () => {
    assert(
      property(orderInputArb, ([window, rules]) => {
        expect(arrange(window, rules).tabs.map(({ id }) => id)).toStrictEqual(expectedTabIds(window, rules));
      }),
    );
  });

  it("グループを今より左（または同じ位置）へ動かす操作だけを出し、ピン留めのタブより左へは動かさない", () => {
    assert(
      property(orderInputArb, ([window, rules]) => {
        expect(movesIntoPinned(window, rules)).toStrictEqual([]);
        expect(() => arrange(window, rules)).not.toThrow();
      }),
    );
  });

  it("計画を適用しても、タブの集合と各タブの所属は変わらない", () => {
    assert(
      property(orderInputArb, ([window, rules]) => {
        expect(sortedById(arrange(window, rules).tabs)).toStrictEqual(sortedById(window.tabs));
      }),
    );
  });

  it("計画を適用した後にもう一度計画すると、操作は空になる", () => {
    assert(
      property(orderInputArb, ([window, rules]) => {
        expect(planGroupOrder(arrange(window, rules), rules)).toStrictEqual([]);
      }),
    );
  });
});
