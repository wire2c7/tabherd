import { describe, expect, it, onTestFinished, vi } from "vitest";

import { createMemoryStorageItem } from "../testing/storage";
import type { ParsedRules } from "./parse";
import { RULES_ITEM, createRulesStore } from "./storage";
import type { Rule } from "./types";

function createStore() {
  const item = createMemoryStorageItem(RULES_ITEM);
  return { item, store: createRulesStore(item) };
}

describe("ルールの一覧の保存", () => {
  it("何も保存されていなければ空の一覧を返す", async () => {
    const { store } = createStore();
    await expect(store.read()).resolves.toStrictEqual({ rules: [], damage: null });
  });

  it("保存したルールを同じ順番で読み込む", async () => {
    const { store } = createStore();
    const rules: Rule[] = [
      { id: "a", name: "業務", color: "red", conditions: [{ type: "contains", value: "example.com" }] },
      { id: "b", name: "開発", color: "blue", conditions: [{ type: "regex", value: "^https://github\\.com/" }] },
    ];
    await store.write(rules);
    await expect(store.read()).resolves.toStrictEqual({ rules, damage: null });
  });

  it("拡張機能のローカルストレージの rules に保存する", () => {
    expect(RULES_ITEM.key).toBe("local:rules");
  });
});

describe("ルールの一覧の読み込み", () => {
  it("壊れた値を直して返し、保存された値は書き換えない", async () => {
    const { item, store } = createStore();
    const broken = [{ id: "a", name: "開発", color: "blue", conditions: null }];
    item.store(broken);
    await expect(store.read()).resolves.toStrictEqual({
      rules: [{ id: "a", name: "開発", color: "blue", conditions: [] }],
      damage: { notArray: false, droppedRules: 0, repairedRules: 1 },
    });
    expect(item.stored).toStrictEqual(broken);
  });

  it("変更前と変更後の一覧を、壊れた箇所を直して通知する", () => {
    const { item, store } = createStore();
    const listener = vi.fn<(newRules: ParsedRules, oldRules: ParsedRules) => void>();
    onTestFinished(store.watch(listener));
    item.store("broken");
    expect(listener).toHaveBeenCalledWith(
      { rules: [], damage: { notArray: true, droppedRules: 0, repairedRules: 0 } },
      { rules: [], damage: null },
    );
  });
});
