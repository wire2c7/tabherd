import { describe, expect, it, onTestFinished, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { LOGS_ITEM } from "../../utils/logging/storage";
import { DAMAGE_WARNED_ITEM } from "../../utils/rules/reader";
import { RULES_ITEM } from "../../utils/rules/storage";
import { defineStorageItem } from "./storage";

describe("定義から作った StorageItem", () => {
  it("定義のキーの領域・名前で読み書きする", async () => {
    // 前提: fakeBrowser をリセットした直後で、"local:rules" キーに何も保存されていない
    // 検証: setValue で保存した値が定義のキー・領域にそのまま書き込まれる、保存済みの値が壊れていても getValue はそのまま返す、removeValue 後は fallback に戻る
    fakeBrowser.reset();
    const item = defineStorageItem<string[]>({ key: "local:rules", fallback: [] });
    await item.setValue(["a"]);
    await expect(fakeBrowser.storage.local.get("rules")).resolves.toStrictEqual({ rules: ["a"] });
    await fakeBrowser.storage.local.set({ rules: "broken" });
    await expect(item.getValue()).resolves.toBe("broken");
    await item.removeValue();
    await expect(item.getValue()).resolves.toStrictEqual([]);
  });

  it("保存されていなければ fallback を読み、変更の通知にも fallback を渡す", async () => {
    // 前提: "session:warned" キーに何も保存されていない状態で fallback に false を指定する
    // 検証: getValue は fallback の false を返す、値が変化したとき watch のリスナーには新しい値・旧値として fallback が渡る
    fakeBrowser.reset();
    const item = defineStorageItem({ key: "session:warned", fallback: false });
    await expect(item.getValue()).resolves.toBe(false);
    const listener = vi.fn<(newValue: unknown, oldValue: unknown) => void>();
    onTestFinished(item.watch(listener));
    await fakeBrowser.storage.session.set({ warned: true });
    expect(listener).toHaveBeenCalledWith(true, false);
  });
});

describe("保存する値の定義", () => {
  // キーを変えると、利用者がこれまでに保存した値を読めなくなる
  it("ルール・ログ・壊れたルールの警告の状態を、これまでと同じ chrome.storage のキーに保存する", async () => {
    // 前提: RULES_ITEM・LOGS_ITEM・DAMAGE_WARNED_ITEM の定義を使って空のルール・ログ、警告済みの状態を保存する
    // 検証: chrome.storage.local には "rules"・"logs" キーで、chrome.storage.session には "rulesDamageWarned" キーで保存される
    fakeBrowser.reset();
    await defineStorageItem(RULES_ITEM).setValue([]);
    await defineStorageItem(LOGS_ITEM).setValue([]);
    await defineStorageItem(DAMAGE_WARNED_ITEM).setValue(true);
    await expect(fakeBrowser.storage.local.get(null)).resolves.toStrictEqual({ rules: [], logs: [] });
    await expect(fakeBrowser.storage.session.get(null)).resolves.toStrictEqual({ rulesDamageWarned: true });
  });
});
