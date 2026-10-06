import { getLogger } from "@logtape/logtape";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { captureLogs } from "../logging/testing/capture";
import type { MemoryStorageItem } from "../testing/storage";
import { createMemoryStorageItem } from "../testing/storage";
import type { RulesReader } from "./reader";
import { DAMAGE_WARNED_ITEM, createRulesReader } from "./reader";
import { RULES_ITEM, createRulesStore } from "./storage";
import type { Rule } from "./types";

const DEV: Rule = { id: "a", name: "開発", color: "blue", conditions: [{ type: "contains", value: "/dev/" }] };
const BROKEN_DEV = { ...DEV, conditions: null };

/** ルールと警告の状態の保存先。Service Worker が起き直しても残る */
interface ReaderStorage {
  rules: MemoryStorageItem<Rule[]>;
  damageWarned: MemoryStorageItem<boolean>;
}

function createStorage(): ReaderStorage {
  return { rules: createMemoryStorageItem(RULES_ITEM), damageWarned: createMemoryStorageItem(DAMAGE_WARNED_ITEM) };
}

/** RulesReader を作る。Service Worker が起き直したときは、同じ storage で作り直す */
function createReader({ rules, damageWarned }: ReaderStorage): RulesReader {
  return createRulesReader(createRulesStore(rules), damageWarned, getLogger(["tabherd", "test"]));
}

function warnings(records: ReturnType<typeof captureLogs>): number {
  return records.filter((record) => record.level === "warning").length;
}

describe("バックグラウンドの処理のルールの読み込み", () => {
  it("壊れた値を直して返し、警告のログを残す", async () => {
    // 前提: 保存値が壊れている（BROKEN_DEV の conditions が null）
    // 検証: read() が直した値を返し、警告のログが1件、properties に壊れ方（damage）が残る
    const storage = createStorage();
    const records = captureLogs();
    storage.rules.store([BROKEN_DEV]);
    const reader = createReader(storage);
    await expect(reader.read()).resolves.toStrictEqual([{ ...DEV, conditions: [] }]);
    expect(warnings(records)).toBe(1);
    expect(records[0]?.properties).toStrictEqual({ notArray: false, droppedRules: 0, repairedRules: 1 });
  });

  it("壊れていない値を読むまでは、警告を繰り返さない", async () => {
    // 前提: 壊れた値を2回連続で読んだ後、壊れていない値を挟んでから、別の壊れた値を読む
    // 検証: 同じ壊れ方が続く間は警告が増えず（1のまま）、壊れていない値を挟んだ後の新しい壊れ方では警告が増える（2になる）
    const storage = createStorage();
    const records = captureLogs();
    const reader = createReader(storage);
    storage.rules.store([BROKEN_DEV]);
    await reader.read();
    await reader.read();
    expect(warnings(records)).toBe(1);
    storage.rules.store([DEV]);
    await reader.read();
    storage.rules.store("broken");
    await reader.read();
    expect(warnings(records)).toBe(2);
  });

  it("変更を直して通知し、変更後の値が壊れていれば警告する", async () => {
    // 前提: watch で購読した後、正しい値から壊れた値（BROKEN_DEV）に変更する
    // 検証: リスナーには直した新しい値と直前の正しい値が渡り、警告のログが1件残る
    const storage = createStorage();
    const records = captureLogs();
    const reader = createReader(storage);
    const listener = vi.fn<(newRules: Rule[], oldRules: Rule[]) => void>();
    onTestFinished(reader.watch(listener));
    storage.rules.store([DEV]);
    storage.rules.store([BROKEN_DEV]);
    expect(listener).toHaveBeenLastCalledWith([{ ...DEV, conditions: [] }], [DEV]);
    await vi.waitFor(() => {
      expect(warnings(records)).toBe(1);
    });
  });
});

describe("壊れたルールの警告の繰り返し", () => {
  it("起動し直しても、壊れていない値を読むまでは警告を繰り返さない", async () => {
    // 前提: Service Worker が起き直した想定で、都度 createReader を作り直しながら同じ壊れた値を読み、間に正しい値を挟んで別の壊れた値を読む
    // 検証: reader を作り直しても、同じ壊れ方では警告が増えず、新しい壊れ方で初めて警告が増える（1→2）
    const storage = createStorage();
    const records = captureLogs();
    storage.rules.store([BROKEN_DEV]);
    await createReader(storage).read();
    // Service Worker が止まって起き直すと変数が消えるため、作り直した RulesReader で読む
    await createReader(storage).read();
    expect(warnings(records)).toBe(1);
    storage.rules.store([DEV]);
    await createReader(storage).read();
    storage.rules.store([BROKEN_DEV]);
    await createReader(storage).read();
    expect(warnings(records)).toBe(2);
  });

  it("同時に読んでも、警告は1回だけ残す", async () => {
    // 前提: 同じ壊れた値に対して read() を3回同時に呼ぶ
    // 検証: 警告のログは1件だけ残る
    const storage = createStorage();
    const records = captureLogs();
    storage.rules.store([BROKEN_DEV]);
    const reader = createReader(storage);
    await Promise.all([reader.read(), reader.read(), reader.read()]);
    expect(warnings(records)).toBe(1);
  });
});
