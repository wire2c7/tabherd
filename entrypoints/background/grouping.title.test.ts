import { describe, expect, it, vi } from "vitest";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { debounceChanges } from "../../utils/grouping/debounce";
import { createSerialQueue } from "../../utils/grouping/serial";
import type { Rule } from "../../utils/rules/types";
import { stub, useFakeTimersInTest } from "../../utils/testing/mocks";
import { onTabRemoved, onTitleChanged } from "./grouping";

const PR: Rule = {
  id: "pr",
  name: "レビュー",
  color: "orange",
  conditions: [{ target: "title", type: "contains", value: "Pull Request" }],
};
const PR_URL = "https://github.com/wire2c7/tabherd/pull/99";
const PR_TITLE = "Add title condition · Pull Request #99";

/** テストで使う項目だけを指定した browser.tabs.Tab を作る */
function fakeTab(
  tab: Pick<Browser.tabs.Tab, "id" | "windowId" | "url" | "groupId"> & Partial<Pick<Browser.tabs.Tab, "title">>,
): Browser.tabs.Tab {
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

/** ウィンドウ windowId にタブ10（PR のタイトルを持つ）だけがあり、グループが無い状態にする */
function mockPrTabWindow(windowId: number) {
  stub(
    fakeBrowser.tabs,
    "query",
    vi
      .fn<(queryInfo: Browser.tabs.QueryInfo) => Promise<Browser.tabs.Tab[]>>()
      .mockResolvedValue([fakeTab({ id: 10, url: PR_URL, groupId: -1, windowId, title: PR_TITLE })]),
  );
  stub(
    fakeBrowser.tabGroups,
    "query",
    vi.fn<(queryInfo: Browser.tabGroups.QueryInfo) => Promise<Browser.tabGroups.TabGroup[]>>().mockResolvedValue([]),
  );
  const group = vi.fn<(options: Browser.tabs.GroupOptions) => Promise<number>>().mockResolvedValue(100);
  stub(fakeBrowser.tabs, "group", group);
  stub(
    fakeBrowser.tabs,
    "get",
    vi
      .fn<(tabId: number) => Promise<Browser.tabs.Tab>>()
      .mockResolvedValue(fakeTab({ id: 10, url: PR_URL, groupId: -1, windowId, title: PR_TITLE })),
  );
  return { group };
}

/** rulesReader.read() が読む保存されたルールの一覧を設定する（本番の storage への保存に相当） */
async function setStoredRules(rules: readonly Rule[]): Promise<void> {
  await fakeBrowser.storage.local.set({ rules: [...rules] });
}

/** grouping.ts の regroupOnEvents が作るタイトル変化の判定を、本番と同じ onTitleChanged で組み立てる */
function createHarness() {
  const enqueue = createSerialQueue();
  const titleChangeDebounce = new Map<number, ReturnType<typeof debounceChanges<string>>>();
  return {
    onTitleChanged: onTitleChanged(enqueue, titleChangeDebounce),
    /** キューに積まれた処理がすべて終わるまで待つ */
    flush: async () =>
      enqueue(async () => {
        // キューを進めるためだけの空の処理
      }),
  };
}

describe("タイトル変化のデバウンス", () => {
  it("短い間隔で何度もタイトルが変わっても、デバウンスの確定後に1回だけ判定し直す", async () => {
    // 前提: タイトルを対象にした条件を持つルールがあり、500ms のデバウンス中に3回タイトルが変わる
    // 検証: 最後の変化から500ms経つまで判定し直しは起こらず、経つと1回だけ group が呼ばれる
    useFakeTimersInTest();
    fakeBrowser.reset();
    const { group } = mockPrTabWindow(1);
    await setStoredRules([PR]);
    const { onTitleChanged: onTitle, flush } = createHarness();
    const tab = fakeTab({ id: 10, url: PR_URL, groupId: -1, windowId: 1 });

    onTitle(10, { title: "Add title condition" }, tab);
    await vi.advanceTimersByTimeAsync(200);
    onTitle(10, { title: "Add title condition (2)" }, tab);
    await vi.advanceTimersByTimeAsync(200);
    onTitle(10, { title: PR_TITLE }, tab);
    expect(group).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    expect(group).toHaveBeenCalledTimes(1);
  });
});

describe("タイトル変化のデバウンス中のウィンドウ移動", () => {
  it("デバウンス中にタブが別ウィンドウへ移っても、確定後はそのときの（移動後の）ウィンドウで判定される", async () => {
    // 前提: タイトル変化のデバウンス中（最初のイベントはウィンドウ1）に、タブがウィンドウ2へ移る
    // 検証: 確定後の判定は、デバウンス開始時点のウィンドウ1ではなく、そのとき browser.tabs.get が返すウィンドウ2で行われる
    useFakeTimersInTest();
    fakeBrowser.reset();
    const { group } = mockPrTabWindow(2);
    await setStoredRules([PR]);
    const { onTitleChanged: onTitle, flush } = createHarness();
    const tab = fakeTab({ id: 10, url: PR_URL, groupId: -1, windowId: 1 });

    // タイトル変化のデバウンスが始まった時点ではウィンドウ1（tabs.get はすでにウィンドウ2を返す）
    onTitle(10, { title: PR_TITLE }, tab);
    await vi.advanceTimersByTimeAsync(500);
    await flush();

    expect(group).toHaveBeenCalledWith({ createProperties: { windowId: 2 }, tabIds: [10] });
  });
});

describe("タイトル変化のデバウンスの後片付け（タブを閉じたとき）", () => {
  it("タブを閉じると、そのタブの debounce インスタンスが Map から削除される", () => {
    // 前提: タブ10のタイトル変化のデバウンスが進行中の状態で、タブ10が閉じられる
    // 検証: 閉じた後、同じタブ ID はデバウンスの Map から見つからなくなる
    const debounceByTab = new Map<number, ReturnType<typeof debounceChanges<string>>>([
      [10, debounceChanges<string>(500)],
    ]);

    onTabRemoved(debounceByTab)(10);

    expect(debounceByTab.has(10)).toBe(false);
  });
});
