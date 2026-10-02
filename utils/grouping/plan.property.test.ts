import { assert, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { findMatchingRule, validRules } from "../rules/match";
import { TAB_GROUP_ID_NONE, planGrouping } from "./plan";
import { groupingInputArb } from "./testing/arbitraries";
import type { GroupingInput } from "./testing/arbitraries";
import { applyOperations } from "./testing/model";
import type { TabSnapshot, WindowSnapshot } from "./types";

// グループに入っていないことを、グループのタイトルの代わりに表す
const UNGROUPED = null;

function groupTitleOf(window: WindowSnapshot, tab: TabSnapshot): string | null | undefined {
  if (tab.groupId === TAB_GROUP_ID_NONE) {
    return UNGROUPED;
  }
  return window.groups.find((group) => group.id === tab.groupId)?.title;
}

/** planGrouping が操作してよいタブか。ピン留め・判定の対象外・管理対象でないグループ・スナップショットに無いグループのタブは触れない */
function isTouchable(input: GroupingInput, tab: TabSnapshot): boolean {
  const { window, rules, options } = input;
  if (tab.pinned || !(options.targetTabIds?.has(tab.id) ?? true)) {
    return false;
  }
  const title = groupTitleOf(window, tab);
  const managedTitles = new Set([...validRules(rules).map((rule) => rule.name), ...(options.retiredNames ?? [])]);
  return title === UNGROUPED || (title !== undefined && managedTitles.has(title));
}

/** 操作してよいタブが入っているべきグループのタイトル。一致するルールが無ければグループに入っていない */
function expectedTitleOf(input: GroupingInput, tab: TabSnapshot): string | null {
  return findMatchingRule(tab.url, input.rules)?.name ?? UNGROUPED;
}

/** 計画を適用した後の、所属が期待と違うタブを返す */
function membershipProblems(input: GroupingInput): string[] {
  const applied = applyOperations(input.window, planGrouping(input.window, input.rules, input.options));
  return input.window.tabs.flatMap((tab) => {
    const after = applied.tabs.find(({ id }) => id === tab.id);
    if (after === undefined) {
      return [`タブ ${tab.id} が無くなった`];
    }
    if (!isTouchable(input, tab)) {
      return after.groupId === tab.groupId ? [] : [`触れないタブ ${tab.id} の所属が変わった`];
    }
    const actual = groupTitleOf(applied, after);
    const expected = expectedTitleOf(input, tab);
    return actual === expected ? [] : [`タブ ${tab.id} が ${String(actual)} にある（期待は ${String(expected)}）`];
  });
}

/** 操作に現れてはならないタブ（触れないタブ・すでに正しいグループにあるタブ）と、複数の操作に現れるタブを返す */
function operationProblems(input: GroupingInput): string[] {
  const operations = planGrouping(input.window, input.rules, input.options);
  const tabIds = operations.flatMap((operation) => ("tabIds" in operation ? operation.tabIds : []));
  const problems = tabIds
    .filter((id, index) => tabIds.indexOf(id) !== index)
    .map((id) => `タブ ${id} が複数の操作に現れる`);
  for (const id of new Set(tabIds)) {
    const tab = input.window.tabs.find((candidate) => candidate.id === id);
    if (tab === undefined || !isTouchable(input, tab)) {
      problems.push(`触れないタブ ${id} に操作が出た`);
    } else if (groupTitleOf(input.window, tab) === expectedTitleOf(input, tab)) {
      problems.push(`すでに正しいグループにあるタブ ${id} に操作が出た`);
    }
  }
  return problems;
}

function replanAfterApplying({ window, rules, options }: GroupingInput): ReturnType<typeof planGrouping> {
  const applied = applyOperations(window, planGrouping(window, rules, options));
  return planGrouping(applied, rules, options);
}

// #47 の反例。「資料」のグループの元のタブ（どのルールにも一致しない）をすべて外し、同じグループへ .org のタブを入れる
const EMPTIED_GROUP_EXAMPLE: GroupingInput = {
  window: {
    id: 1,
    tabs: [
      { id: 1, url: "https://github.com/a", pinned: false, groupId: 100 },
      { id: 2, url: "https://EXAMPLE.org/b", pinned: false, groupId: TAB_GROUP_ID_NONE },
    ],
    groups: [{ id: 100, title: "資料", color: "cyan" }],
  },
  rules: [{ id: "rule-0", name: "資料", color: "cyan", conditions: [{ type: "contains", value: ".org" }] }],
  options: {},
};

// #47 の反例。「資料」のグループの元のタブを「開発」のグループへ移し、空になった「資料」のグループへ .org のタブを入れる
const EMPTIED_BY_MOVE_EXAMPLE: GroupingInput = {
  window: {
    id: 1,
    tabs: [
      { id: 1, url: "https://github.com/a", pinned: false, groupId: 100 },
      { id: 2, url: "https://EXAMPLE.org/b", pinned: false, groupId: TAB_GROUP_ID_NONE },
      { id: 3, url: "https://github.com/b", pinned: false, groupId: 101 },
    ],
    groups: [
      { id: 100, title: "資料", color: "cyan" },
      { id: 101, title: "開発", color: "blue" },
    ],
  },
  rules: [
    { id: "rule-0", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github" }] },
    { id: "rule-1", name: "資料", color: "cyan", conditions: [{ type: "contains", value: ".org" }] },
  ],
  options: {},
};

describe("planGrouping の性質", () => {
  it("計画を適用すると、操作してよいタブは一致したルールのグループに入り、ほかのタブの所属は変わらない", () => {
    assert(
      property(groupingInputArb, (input) => {
        expect(membershipProblems(input)).toStrictEqual([]);
      }),
      { examples: [[EMPTIED_GROUP_EXAMPLE], [EMPTIED_BY_MOVE_EXAMPLE]] },
    );
  });

  it("触れないタブとすでに正しいグループにあるタブには操作を出さず、各タブは高々1つの操作に現れる", () => {
    assert(
      property(groupingInputArb, (input) => {
        expect(operationProblems(input)).toStrictEqual([]);
      }),
      { examples: [[EMPTIED_GROUP_EXAMPLE], [EMPTIED_BY_MOVE_EXAMPLE]] },
    );
  });

  it("計画を適用した後にもう一度計画すると、操作は空になる", () => {
    assert(
      property(groupingInputArb, (input) => {
        expect(replanAfterApplying(input)).toStrictEqual([]);
      }),
      { examples: [[EMPTIED_GROUP_EXAMPLE], [EMPTIED_BY_MOVE_EXAMPLE]] },
    );
  });
});
