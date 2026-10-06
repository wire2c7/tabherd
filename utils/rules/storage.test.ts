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
    // 前提: ストレージに何も保存していない
    // 検証: rules が空配列、damage が null になる
    const { store } = createStore();
    await expect(store.read()).resolves.toStrictEqual({ rules: [], damage: null });
  });

  it("保存したルールを同じ順番で読み込む", async () => {
    // 前提: 2件のルールを write で保存する
    // 検証: read() が同じ内容・同じ順番で返す
    const { store } = createStore();
    const rules: Rule[] = [
      { id: "a", name: "業務", color: "red", conditions: [{ type: "contains", value: "example.com" }] },
      { id: "b", name: "開発", color: "blue", conditions: [{ type: "regex", value: "^https://github\\.com/" }] },
    ];
    await store.write(rules);
    await expect(store.read()).resolves.toStrictEqual({ rules, damage: null });
  });

  it("拡張機能のローカルストレージの rules に保存する", () => {
    // 前提: なし
    // 検証: RULES_ITEM のキーが "local:rules" になる
    expect(RULES_ITEM.key).toBe("local:rules");
  });
});

describe("ルールの一覧の読み込み", () => {
  it("壊れた値を直して返し、保存された値は書き換えない", async () => {
    // 前提: 保存値が壊れている（conditions が null）
    // 検証: read() は直した値（conditions が空配列）を返すが、保存されている生の値（item.stored）は書き換わらない
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
    // 前提: watch で購読した後、保存値を壊れた値（配列でない "broken"）に変更する
    // 検証: リスナーに、直した新しい値（空配列・notArray: true）と変更前の値（空配列・damage: null）が渡る
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
