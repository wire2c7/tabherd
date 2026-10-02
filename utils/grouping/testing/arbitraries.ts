// タブの操作の計画の性質のテストに使う入力の arbitrary。Chrome が作りうるウィンドウだけを生成する
import { array, constant, constantFrom, oneof, option, record, subarray, tuple } from "fast-check";
import type { Arbitrary } from "fast-check";

import { GROUP_COLORS } from "../../rules/types";
import type { Condition, GroupColor, Rule } from "../../rules/types";
import { TAB_GROUP_ID_NONE } from "../plan";
import type { PlanGroupingOptions } from "../plan";
import type { GroupSnapshot, TabSnapshot, WindowSnapshot } from "../types";

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
export const rulesArb: Arbitrary<Rule[]> = array(ruleSpecArb, { maxLength: 5 }).map((specs) =>
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

export const windowArb: Arbitrary<WindowSnapshot> = tuple(
  array(urlArb, { maxLength: 2 }),
  array(blockArb, { maxLength: 6 }),
).map(([pinnedUrls, blocks]) => buildWindow(pinnedUrls, blocks));

export interface GroupingInput {
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

export const groupingInputArb: Arbitrary<GroupingInput> = tuple(windowArb, rulesArb).chain(([window, rules]) =>
  groupingInputArbFor(window, rules),
);
