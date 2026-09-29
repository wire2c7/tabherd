import { describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { rulesItem } from "./storage";
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
