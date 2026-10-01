import { array, assert, constant, constantFrom, oneof, option, property, record, subarray, tuple } from "fast-check";
import type { Arbitrary } from "fast-check";
import { describe, expect, it } from "vitest";

import { GROUP_COLORS } from "../rules/types";
import type { Condition, GroupColor, Rule } from "../rules/types";
import { TAB_GROUP_ID_NONE } from "./plan";
import type { PlanGroupingOptions } from "./plan";
import type { GroupSnapshot, TabSnapshot, WindowSnapshot } from "./types";

// 同名のグループ・管理対象でないグループ・無効なルールが頻繁に現れるよう、名前は少数の候補から選ぶ。
// 「手動」はルールの名前にならないため、retiredNames に入らない限り管理対象でないグループになる
const RULE_NAMES = ["開発", "業務", "資料", " ", ""] as const;
const GROUP_TITLES = ["開発", "業務", "資料", "手動", ""] as const;

// 条件に一致するタブと一致しないタブが両方現れるよう、URL と条件の値も少数の部品から組み立てる
const hostArb = constantFrom("github.com", "example.com", "EXAMPLE.org");
const pathArb = constantFrom("a", "b");
const urlArb = tuple(hostArb, pathArb).map(([host, path]) => `https://${host}/${path}`);

const containsArb: Arbitrary<Condition> = record({
  type: constant("contains" as const),
  value: constantFrom("github", "example", "EXAMPLE", ".org", ""),
});
// 「(」は構文が不正な正規表現
const regexArb: Arbitrary<Condition> = record({
  type: constant("regex" as const),
  value: constantFrom(String.raw`^https://github`, String.raw`\.com/`, "(", ""),
});
const conditionArb = oneof(containsArb, regexArb);

const colorArb: Arbitrary<GroupColor> = constantFrom(...GROUP_COLORS);

const ruleSpecArb = record({
  name: constantFrom(...RULE_NAMES),
  color: colorArb,
  conditions: array(conditionArb, { maxLength: 3 }),
});
const rulesArb: Arbitrary<Rule[]> = array(ruleSpecArb, { maxLength: 5 }).map((specs) =>
  specs.map((spec, index) => ({ id: `rule-${index}`, ...spec })),
);

/** タブバー上の並びの単位。グループのタブは連続するため、グループは中のタブの URL をまとめて持つ */
type BlockSpec =
  | { kind: "tab"; url: string }
  /** inSnapshot が false のグループは、スナップショットのグループの一覧に載せない（取得の途中でグループが変わった場合） */
  | { kind: "group"; title: string; color: GroupColor; urls: string[]; inSnapshot: boolean };

const tabBlockArb: Arbitrary<BlockSpec> = record({ kind: constant("tab" as const), url: urlArb });
const inSnapshotArb = oneof({ arbitrary: constant(true), weight: 9 }, { arbitrary: constant(false), weight: 1 });
const groupBlockArb: Arbitrary<BlockSpec> = record({
  kind: constant("group" as const),
  title: constantFrom(...GROUP_TITLES),
  color: colorArb,
  urls: array(urlArb, { minLength: 1, maxLength: 3 }),
  inSnapshot: inSnapshotArb,
});
const blockArb = oneof(tabBlockArb, groupBlockArb);

function pushTab(tabs: TabSnapshot[], tab: Omit<TabSnapshot, "id">): void {
  tabs.push({ id: tabs.length + 1, ...tab });
}

// ピン留めされたタブは先頭に並び、グループに入らない（Chrome の制約）
function buildWindow(pinnedUrls: readonly string[], blocks: readonly BlockSpec[]): WindowSnapshot {
  const tabs: TabSnapshot[] = [];
  const groups: GroupSnapshot[] = [];
  for (const url of pinnedUrls) {
    pushTab(tabs, { url, pinned: true, groupId: TAB_GROUP_ID_NONE });
  }
  for (const [index, block] of blocks.entries()) {
    if (block.kind === "tab") {
      pushTab(tabs, { url: block.url, pinned: false, groupId: TAB_GROUP_ID_NONE });
    } else {
      const groupId = 100 + index;
      if (block.inSnapshot) {
        groups.push({ id: groupId, title: block.title, color: block.color });
      }
      for (const url of block.urls) {
        pushTab(tabs, { url, pinned: false, groupId });
      }
    }
  }
  return { id: 1, tabs, groups };
}

const windowArb: Arbitrary<WindowSnapshot> = tuple(
  array(urlArb, { maxLength: 2 }),
  array(blockArb, { maxLength: 6 }),
).map(([pinnedUrls, blocks]) => buildWindow(pinnedUrls, blocks));

interface GroupingInput {
  window: WindowSnapshot;
  rules: Rule[];
  options: PlanGroupingOptions;
}

// targetTabIds は省略するか、ウィンドウのタブから選ぶ
function groupingInputArbFor(window: WindowSnapshot, rules: Rule[]): Arbitrary<GroupingInput> {
  const targetArb = option(subarray(window.tabs.map((tab) => tab.id)), { nil: undefined });
  const retiredArb = subarray([...GROUP_TITLES]);
  return tuple(targetArb, retiredArb).map(([targetIds, retiredNames]) => ({
    window,
    rules,
    options: targetIds === undefined ? { retiredNames } : { targetTabIds: new Set(targetIds), retiredNames },
  }));
}

const groupingInputArb: Arbitrary<GroupingInput> = tuple(windowArb, rulesArb).chain(([window, rules]) =>
  groupingInputArbFor(window, rules),
);

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
