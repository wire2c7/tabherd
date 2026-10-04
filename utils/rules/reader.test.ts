import { getLogger } from "@logtape/logtape";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { captureLogs } from "../logging/testing/capture";
import { createRulesReader } from "./reader";
import type { Rule } from "./types";

const DEV: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };
const BROKEN_DEV = { ...DEV, conditions: null };

function warnings(records: ReturnType<typeof captureLogs>): number {
  return records.filter((record) => record.level === "warning").length;
}

describe("バックグラウンドの処理のルールの読み込み", () => {
  it("壊れた値を直して返し、警告のログを残す", async () => {
    fakeBrowser.reset();
    const records = captureLogs();
    await fakeBrowser.storage.local.set({ rules: [BROKEN_DEV] });
    const reader = createRulesReader(getLogger(["tabherd", "test"]));
    await expect(reader.read()).resolves.toStrictEqual([{ ...DEV, conditions: [] }]);
    expect(warnings(records)).toBe(1);
    expect(records[0]?.properties).toStrictEqual({ notArray: false, droppedRules: 0, repairedRules: 1 });
  });

  it("壊れていない値を読むまでは、警告を繰り返さない", async () => {
    fakeBrowser.reset();
    const records = captureLogs();
    const reader = createRulesReader(getLogger(["tabherd", "test"]));
    await fakeBrowser.storage.local.set({ rules: [BROKEN_DEV] });
    await reader.read();
    await reader.read();
    expect(warnings(records)).toBe(1);
    await fakeBrowser.storage.local.set({ rules: [DEV] });
    await reader.read();
    await fakeBrowser.storage.local.set({ rules: "broken" });
    await reader.read();
    expect(warnings(records)).toBe(2);
  });

  it("変更を直して通知し、変更後の値が壊れていれば警告する", async () => {
    fakeBrowser.reset();
    const records = captureLogs();
    const reader = createRulesReader(getLogger(["tabherd", "test"]));
    const listener = vi.fn<(newRules: Rule[], oldRules: Rule[]) => void>();
    onTestFinished(reader.watch(listener));
    await fakeBrowser.storage.local.set({ rules: [DEV] });
    await fakeBrowser.storage.local.set({ rules: [BROKEN_DEV] });
    expect(listener).toHaveBeenLastCalledWith([{ ...DEV, conditions: [] }], [DEV]);
    expect(warnings(records)).toBe(1);
  });
});
