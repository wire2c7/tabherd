import { describe, expect, it, vi } from "vitest";

import { debounceChanges } from "../../utils/grouping/debounce";
import { applyRuleChange, regroupTabs } from "../../utils/grouping/regroup";
import { createSerialQueue } from "../../utils/grouping/serial";
import { createMockTabsApi } from "../../utils/grouping/testing/tabs";
import type { Rule } from "../../utils/rules/types";
import { NO_TITLES } from "../../utils/rules/types";
import { useFakeTimersInTest } from "../../utils/testing/mocks";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };

function mockDevTabWindow() {
  const api = createMockTabsApi();
  api.queryTabs.mockResolvedValue([
    { id: 10, index: 0, url: "https://example.com/dev/1", groupId: -1, windowId: 1, pinned: false },
  ]);
  api.queryGroups.mockResolvedValue([]);
  api.group.mockResolvedValue(100);
  return api;
}

/**
 * grouping.ts の regroupOnEvents の設計（ルール変更の反映は、バーストの最初の変更時点でキューへ積み、
 * タスク自身がデバウンスの確定を待つ。タブイベントは待たずにその場でキューへ積む）を、
 * utils/grouping のモック TabsApi だけで再現する
 */
function createHarness(api: ReturnType<typeof createMockTabsApi>) {
  const enqueue = createSerialQueue();
  const { onChange, waitUntilSettled } = debounceChanges<readonly Rule[]>(300, () => {
    // 実際の反映は onRulesChanged が積むタスク自身が行うため、ここでは何もしない
  });
  let isBurstPending = false;
  // 本番の rulesReader.read() に相当。タブイベント・反映タスクのどちらも、実行時点の最新値を読む
  let currentRules: readonly Rule[] = [];

  async function onRulesChanged(newRules: readonly Rule[], oldRules: readonly Rule[]): Promise<void> {
    currentRules = newRules;
    onChange(newRules, oldRules);
    if (isBurstPending) {
      return;
    }
    isBurstPending = true;
    await enqueue(async () => {
      await waitUntilSettled();
      isBurstPending = false;
      await applyRuleChange(api, oldRules, { rules: currentRules, titles: NO_TITLES });
    });
  }

  async function onTabEvent(windowId: number, tabId: number): Promise<void> {
    await enqueue(async () =>
      regroupTabs(api, { rules: currentRules, titles: NO_TITLES }, { windowId, tabIds: [tabId] }),
    );
  }

  /** テストの前提として、進行中の編集が無い状態の最新ルールを設定する */
  function setSettledRules(rules: readonly Rule[]): void {
    currentRules = rules;
  }

  return { onRulesChanged, onTabEvent, setSettledRules };
}

describe("ルール変更とタブイベントの重なり（Issue #36）", () => {
  it("デバウンス確定前のタブイベントは、確定後の最終的なルールで判定される", async () => {
    // 前提: ルールを保存した直後（デバウンス進行中）にタブイベントが来て、デバウンスの残り時間のうちに色を変える
    // 検証: タブイベントの判定は、デバウンス確定後の反映（最終的な色）を使って行われる
    useFakeTimersInTest();
    const api = mockDevTabWindow();
    const { onRulesChanged, onTabEvent } = createHarness(api);

    // 1. ルールを保存する（バーストが始まり、反映タスクがすぐにキューへ積まれる）
    const applyTask = onRulesChanged([DEV], []);
    // 2. 300ms 以内にタブイベントが来る。反映タスクの後ろに積まれるため、まだ実行されない
    const tabTask = onTabEvent(1, 10);
    await vi.advanceTimersByTimeAsync(100);
    expect(api.group).not.toHaveBeenCalled();
    // 3. デバウンスの残り時間のうちにルールの色を変える（同じバーストのまま、反映タスクは積み直さない）
    void onRulesChanged([{ ...DEV, color: "red" }], []);
    // 4. デバウンスが確定するまで進める
    await vi.advanceTimersByTimeAsync(300);
    await applyTask;
    await tabTask;

    // タブイベントは最終的な色（red）で判定される
    expect(api.group).toHaveBeenCalledWith([10], { windowId: 1 });
    expect(api.updateGroup).toHaveBeenCalledWith(100, { title: "開発", color: "red" });
  });

  it("進行中のバーストが無ければ、タブイベントは待たずに判定される", async () => {
    // 前提: ルールの変更が無い状態でタブイベントが来る
    // 検証: 待たずにそのときのルールで判定される
    const api = mockDevTabWindow();
    const { onTabEvent, setSettledRules } = createHarness(api);
    setSettledRules([DEV]);

    await onTabEvent(1, 10);

    expect(api.group).toHaveBeenCalledWith([10], { windowId: 1 });
  });
});

describe("名前が衝突するルールの編集とタブイベントの重なり（Issue #81）", () => {
  it("デバウンス確定前のタブイベントが名前衝突を誤判定しても、確定後は正しいグループに入る", async () => {
    // 前提: ルール「開発」(id:a, example.orgに一致)を「業務」へ改名し、新ルール「開発」(id:c, github.comに一致)を
    //       同じ保存で追加する。300ms以内に github.com のタブイベントが来る
    useFakeTimersInTest();
    const A: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "example.org" }] };
    const C: Rule = { id: "c", name: "開発", color: "green", conditions: [{ type: "contains", value: "github.com" }] };
    const Arenamed = { ...A, name: "業務" };
    const api = createMockTabsApi();
    api.queryTabs.mockResolvedValue([
      { id: 10, index: 0, url: "https://github.com/", groupId: -1, windowId: 1, pinned: false },
    ]);
    api.queryGroups.mockResolvedValue([]);
    api.group.mockResolvedValue(100);
    const { onRulesChanged, onTabEvent } = createHarness(api);

    // タブイベントがデバウンス確定前の名前衝突（旧titlesでは c が無効）に基づいて判定されても、
    // 反映タスクの後ろに並ぶため、確定後の正しい titles で判定し直される
    const applyTask = onRulesChanged([Arenamed, C], [A]);
    const tabTask = onTabEvent(1, 10);
    await vi.advanceTimersByTimeAsync(300);
    await applyTask;
    await tabTask;

    expect(api.group).toHaveBeenCalledWith([10], { windowId: 1 });
  });
});
