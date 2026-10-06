import { describe, expect, it } from "vitest";

import { toStoredLogEntry } from "../logging/entry";
import { captureLogs } from "../logging/testing/capture";
import type { Rule } from "../rules/types";
import { NO_TITLES } from "../rules/types";
import { applyRuleChange, regroupAllWindows, regroupTabs } from "./regroup";
import type { BrowserTab, BrowserTabGroup } from "./tabs";
import type { MockTabsApi } from "./testing/tabs";
import { createMockTabsApi } from "./testing/tabs";

const DEV: Rule = { id: "dev", name: "開発", color: "blue", conditions: [{ type: "contains", value: "github.com" }] };
const WORK: Rule = { id: "work", name: "業務", color: "red", conditions: [{ type: "contains", value: "example.com" }] };

function browserTab(index: number, url: string, groupId: number): BrowserTab {
  return { id: index + 10, index, url, groupId, windowId: 1, pinned: false };
}

function browserGroup(id: number, title: string): BrowserTabGroup {
  return { id, title, color: "grey", windowId: 1 };
}

// 「開発」「業務」の順にグループが並んだウィンドウを、queryTabs・queryGroups が返すようにする
function mockWindow(): MockTabsApi {
  const api = createMockTabsApi();
  api.queryTabs.mockResolvedValue([
    browserTab(0, "https://github.com/", 100),
    browserTab(1, "https://example.com/", 200),
  ]);
  api.queryGroups.mockResolvedValue([browserGroup(100, "開発"), browserGroup(200, "業務")]);
  api.group.mockResolvedValue(100);
  return api;
}

describe("グループ化とグループの並び", () => {
  it("ルールの順番だけを変えると、グループを動かさずに並びだけを変える", async () => {
    // 前提: 新旧で同じルール（DEV, WORK）だが、変更後は [WORK, DEV] の順に並べ替える
    // 検証: グループ化（api.group）は呼ばれず、業務のグループ(200)を先頭へ動かす api.moveGroup だけが呼ばれる
    const api = mockWindow();

    await applyRuleChange(api, [DEV, WORK], { rules: [WORK, DEV], titles: NO_TITLES });

    expect(api.group).not.toHaveBeenCalled();
    expect(api.moveGroup).toHaveBeenCalledWith(200, 0);
  });

  it("並びがすでに正しいときは、グループを移動しない", async () => {
    // 前提: ウィンドウの実際のグループの並びが、ルールの順（DEV, WORK）とすでに一致している
    // 検証: api.moveGroup が呼ばれない
    const api = mockWindow();

    await regroupAllWindows(api, { rules: [DEV, WORK], titles: NO_TITLES });

    expect(api.moveGroup).not.toHaveBeenCalled();
  });

  it("グループ化の操作をしたときは、スナップショットを取り直してから並びを計画する", async () => {
    // 前提: queryTabs の1回目の応答に、グループ化が必要な新しいタブ(12, groupId -1)を含める
    // 検証: 新しいタブが「開発」グループ(100)へ入り、並びの計画の前に queryTabs が計2回呼ばれる（グループ化後にスナップショットを取り直す）
    const api = mockWindow();
    api.queryTabs.mockResolvedValueOnce([
      browserTab(0, "https://github.com/", 100),
      browserTab(1, "https://example.com/", 200),
      browserTab(2, "https://github.com/new", -1),
    ]);

    await regroupTabs(api, { rules: [DEV, WORK], titles: NO_TITLES }, { windowId: 1, tabIds: [12] });

    expect(api.group).toHaveBeenCalledWith([12], { groupId: 100 });
    expect(api.queryTabs).toHaveBeenCalledTimes(2);
  });
});

describe("グループ化のログ", () => {
  it("操作が失敗しても、ログにグループ名・URL を出さない", async () => {
    // 前提: 新しいタブの URL に秘密のトークンを含み、一致するルール名も秘密で、api.group が失敗する
    // 検証: error レベルのログは残るが、保存されたログ文字列にグループ名・URL・トークン・色等の秘密情報は一切含まれない（操作の種別は残る）
    const logs = captureLogs();
    const api = mockWindow();
    api.queryTabs.mockResolvedValue([
      browserTab(0, "https://github.com/", 100),
      browserTab(1, "https://example.com/", 200),
      browserTab(2, "https://secret.example.org/private?token=abc", -1),
    ]);
    api.group.mockRejectedValue(new Error("No tab with id: 12."));
    const secret: Rule = {
      id: "secret",
      name: "秘密の案件",
      color: "pink",
      conditions: [{ type: "contains", value: "secret.example" }],
    };

    await regroupTabs(api, { rules: [DEV, WORK, secret], titles: NO_TITLES }, { windowId: 1, tabIds: [12] });

    const stored = JSON.stringify(logs.map((record) => toStoredLogEntry(record)));
    expect(logs.some((record) => record.level === "error")).toBe(true);
    expect(stored).toContain("create-group");
    for (const text of ["秘密の案件", "secret.example", "token", "github.com", "開発", "業務", "pink"]) {
      expect(stored).not.toContain(text);
    }
  });
});
