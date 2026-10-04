import { describe, expect, it, onTestFinished, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { ParsedRules } from "./parse";
import { readRules, rulesItem, watchRules } from "./storage";
import type { Rule } from "./types";

describe("ルールの一覧の保存", () => {
  it("何も保存されていなければ空の一覧を返す", async () => {
    fakeBrowser.reset();
    await expect(rulesItem.getValue()).resolves.toStrictEqual([]);
  });

  it("保存したルールを同じ順番で読み込む", async () => {
    fakeBrowser.reset();
    const rules: Rule[] = [
      { id: "a", name: "業務", color: "red", conditions: [{ type: "contains", value: "example.com" }] },
      { id: "b", name: "開発", color: "blue", conditions: [{ type: "regex", value: "^https://github\\.com/" }] },
    ];
    await rulesItem.setValue(rules);
    await expect(rulesItem.getValue()).resolves.toStrictEqual(rules);
  });

  it("拡張機能のローカルストレージに保存する", async () => {
    fakeBrowser.reset();
    await rulesItem.setValue([{ id: "a", name: "開発", color: "blue", conditions: [] }]);
    const stored = await fakeBrowser.storage.local.get("rules");
    expect(stored["rules"]).toHaveLength(1);
  });
});

describe("ルールの一覧の読み込み", () => {
  it("壊れた値を直して返し、保存された値は書き換えない", async () => {
    fakeBrowser.reset();
    const broken = [{ id: "a", name: "開発", color: "blue", conditions: null }];
    await fakeBrowser.storage.local.set({ rules: broken });
    await expect(readRules()).resolves.toStrictEqual({
      rules: [{ id: "a", name: "開発", color: "blue", conditions: [] }],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
    await expect(fakeBrowser.storage.local.get("rules")).resolves.toStrictEqual({ rules: broken });
  });

  it("変更を、壊れた箇所を直して通知する", async () => {
    fakeBrowser.reset();
    const listener = vi.fn<(newRules: ParsedRules, oldRules: ParsedRules) => void>();
    const unwatch = watchRules(listener);
    onTestFinished(unwatch);
    await fakeBrowser.storage.local.set({ rules: "broken" });
    expect(listener).toHaveBeenCalledWith(
      { rules: [], damage: { notArray: true, droppedRules: 0, repairedRules: 0 } },
      { rules: [], damage: null },
    );
  });
});
