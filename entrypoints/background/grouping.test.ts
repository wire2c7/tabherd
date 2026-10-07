import { describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { createSettleGate } from "../../utils/grouping/debounce";
import { createSerialQueue } from "../../utils/grouping/serial";
import type { Rule } from "../../utils/rules/types";
import { stub, useFakeTimersInTest } from "../../utils/testing/mocks";
import { onRulesChanged, regroupTab } from "./grouping";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };

/** テストで使う項目だけを指定した browser.tabs.Tab を作る */
function fakeTab(tab: Pick<Browser.tabs.Tab, "id" | "windowId" | "url" | "groupId">): Browser.tabs.Tab {
  return {
    index: 0,
    pinned: false,
    highlighted: false,
    active: false,
    frozen: false,
    incognito: false,
    // oxlint-disable-next-line typescript/no-deprecated -- Tab型の必須項目のため、使わなくても指定する必要がある
    selected: false,
    discarded: false,
    autoDiscardable: true,
    lastAccessed: 0,
    ...tab,
  };
}

/** ウィンドウ1にタブ10（/dev/を含むURL）だけがあり、グループが無い状態にする */
function mockDevTabWindow() {
  stub(
    fakeBrowser.tabs,
    "query",
    vi
      .fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>()
      .mockResolvedValue([fakeTab({ id: 10, url: "https://example.com/dev/1", groupId: -1, windowId: 1 })]),
  );
  stub(
    fakeBrowser.tabGroups,
    "query",
    vi.fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>().mockResolvedValue([]),
  );
  const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(100);
  stub(fakeBrowser.tabs, "group", group);
  const updateGroup = vi.fn<(groupId: number, properties: Browser.tabGroups.UpdateProperties) => Promise<undefined>>();
  stub(fakeBrowser.tabGroups, "update", updateGroup);
  return { group, updateGroup };
}

/** rulesReader.read() が読む保存されたルールの一覧を設定する（本番の storage への保存に相当） */
async function setStoredRules(rules: readonly Rule[]): Promise<void> {
  await fakeBrowser.storage.local.set({ rules: [...rules] });
}

/**
 * grouping.ts の regroupOnEvents が作る処理（反映は onRulesChanged が積み、タブイベントは
 * regroupTab がそのまま積む）を、本番と同じ onRulesChanged・regroupTab で組み立てる
 */
function createHarness() {
  const enqueue = createSerialQueue();
  return {
    onRulesChanged: onRulesChanged(enqueue, createSettleGate(300)),
    onTabEvent: async (windowId: number, tabId: number) => enqueue(regroupTab(windowId, tabId)),
    /** キューに積まれた処理がすべて終わるまで待つ */
    flush: async () =>
      enqueue(async () => {
        // キューを進めるためだけの空の処理
      }),
  };
}

describe("ルール変更とタブイベントの重なり（Issue #36）", () => {
  it("デバウンス確定前のタブイベントは、確定後の最終的なルールで判定される", async () => {
    // 前提: ルールを保存した直後（デバウンス進行中）にタブイベントが来て、デバウンスの残り時間のうちに色を変える
    // 検証: タブイベントの判定は、デバウンス確定後の反映（最終的な色）を使って行われる
    useFakeTimersInTest();
    fakeBrowser.reset();
    const { group, updateGroup } = mockDevTabWindow();
    await setStoredRules([DEV]);
    const { onRulesChanged: onChange, onTabEvent, flush } = createHarness();

    // 1. ルールを保存する（バーストが始まり、反映タスクがすぐにキューへ積まれる）
    onChange([DEV], []);
    // 2. 300ms 以内にタブイベントが来る。反映タスクの後ろに積まれるため、まだ実行されない
    const tabTask = onTabEvent(1, 10);
    await vi.advanceTimersByTimeAsync(100);
    expect(group).not.toHaveBeenCalled();
    // 3. デバウンスの残り時間のうちにルールの色を変える（同じバーストのまま、反映タスクは積み直さない）
    await setStoredRules([{ ...DEV, color: "red" }]);
    onChange([{ ...DEV, color: "red" }], []);
    // 4. デバウンスが確定するまで進める
    await vi.advanceTimersByTimeAsync(300);
    await tabTask;
    await flush();

    // タブイベントは最終的な色（red）で判定される
    expect(group).toHaveBeenCalledWith({ createProperties: { windowId: 1 }, tabIds: [10] });
    expect(updateGroup).toHaveBeenCalledWith(100, { title: "開発", color: "red" });
  });

  it("進行中のバーストが無ければ、タブイベントは待たずに判定される", async () => {
    // 前提: ルールの変更が無い状態でタブイベントが来る
    // 検証: 待たずにそのときのルールで判定される
    fakeBrowser.reset();
    const { group } = mockDevTabWindow();
    await setStoredRules([DEV]);
    const { onTabEvent } = createHarness();

    await onTabEvent(1, 10);

    expect(group).toHaveBeenCalledWith({ createProperties: { windowId: 1 }, tabIds: [10] });
  });
});

describe("名前が衝突するルールの編集とタブイベントの重なり（Issue #81）", () => {
  it("デバウンス確定前のタブイベントが名前衝突を誤判定しても、確定後は正しいグループに入る", async () => {
    // 前提: ルール「開発」(id:a, example.orgに一致)を「業務」へ改名し、新ルール「開発」(id:c, github.comに一致)を
    //       同じ保存で追加する。300ms以内に github.com のタブイベントが来る
    // 検証: タブイベントの判定は、確定後の正しい titles（c が有効）を使って行われ、github.com のタブはグループに入る
    useFakeTimersInTest();
    fakeBrowser.reset();
    const A: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "example.org" }] };
    const C: Rule = { id: "c", name: "開発", color: "green", conditions: [{ type: "contains", value: "github.com" }] };
    const Arenamed = { ...A, name: "業務" };
    stub(
      fakeBrowser.tabs,
      "query",
      vi
        .fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>()
        .mockResolvedValue([fakeTab({ id: 10, url: "https://github.com/", groupId: -1, windowId: 1 })]),
    );
    stub(
      fakeBrowser.tabGroups,
      "query",
      vi.fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>().mockResolvedValue([]),
    );
    const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(100);
    stub(fakeBrowser.tabs, "group", group);
    await setStoredRules([A]);
    const { onRulesChanged: onChange, onTabEvent } = createHarness();

    // タブイベントがデバウンス確定前の名前衝突（旧titlesでは c が無効）に基づいて判定されても、
    // 反映タスクの後ろに並ぶため、確定後の正しい titles で判定し直される
    await setStoredRules([Arenamed, C]);
    onChange([Arenamed, C], [A]);
    const tabTask = onTabEvent(1, 10);
    await vi.advanceTimersByTimeAsync(300);
    await tabTask;

    expect(group).toHaveBeenCalledWith({ createProperties: { windowId: 1 }, tabIds: [10] });
  });
});
