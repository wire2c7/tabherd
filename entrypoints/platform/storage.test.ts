import { describe, expect, it, onTestFinished, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { defineStorageItem } from "./storage";

describe("定義から作った StorageItem", () => {
  it("定義のキーの領域・名前で読み書きする", async () => {
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
    fakeBrowser.reset();
    const item = defineStorageItem({ key: "session:warned", fallback: false });
    await expect(item.getValue()).resolves.toBe(false);
    const listener = vi.fn<(newValue: unknown, oldValue: unknown) => void>();
    onTestFinished(item.watch(listener));
    await fakeBrowser.storage.session.set({ warned: true });
    expect(listener).toHaveBeenCalledWith(true, false);
  });
});
