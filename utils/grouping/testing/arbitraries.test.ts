import { assert, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { TAB_GROUP_ID_NONE } from "../plan";
import type { WindowSnapshot } from "../types";
import { groupingInputArb, windowArb } from "./arbitraries";
import type { GroupingInput } from "./arbitraries";

/** スナップショットが Chrome の制約を満たさない点を返す */
function snapshotProblems(window: WindowSnapshot): string[] {
  const problems: string[] = [];
  const ids = window.tabs.map((tab) => tab.id);
  if (new Set(ids).size !== ids.length) {
    problems.push("タブの ID が重複している");
  }
  const pinnedCount = window.tabs.filter((tab) => tab.pinned).length;
  if (window.tabs.slice(0, pinnedCount).some((tab) => !tab.pinned || tab.groupId !== TAB_GROUP_ID_NONE)) {
    problems.push("ピン留めされたタブが先頭に並んでいないか、グループに入っている");
  }
  const groupIds = new Set(window.tabs.map((tab) => tab.groupId));
  groupIds.delete(TAB_GROUP_ID_NONE);
  for (const groupId of groupIds) {
    const indexes = window.tabs.flatMap((tab, index) => (tab.groupId === groupId ? [index] : []));
    if ((indexes.at(-1) ?? 0) - (indexes.at(0) ?? 0) + 1 !== indexes.length) {
      problems.push(`グループ ${groupId} のタブが連続していない`);
    }
  }
  for (const group of window.groups) {
    if (!groupIds.has(group.id)) {
      problems.push(`グループ ${group.id} にタブが無い`);
    }
  }
  return problems;
}

/** 判定の対象のうち、ウィンドウに無いタブの ID を返す */
function foreignTargetIds({ window, options }: GroupingInput): number[] {
  const ids = new Set(window.tabs.map((tab) => tab.id));
  return [...(options.targetTabIds ?? [])].filter((id) => !ids.has(id));
}

describe("性質のテストの入力", () => {
  it("スナップショットは Chrome の制約を満たす", () => {
    assert(
      property(windowArb, (window) => {
        expect(snapshotProblems(window)).toStrictEqual([]);
      }),
    );
  });

  it("planGrouping の判定の対象は、ウィンドウのタブから選ばれる", () => {
    assert(
      property(groupingInputArb, (input) => {
        expect(foreignTargetIds(input)).toStrictEqual([]);
      }),
    );
  });
});
