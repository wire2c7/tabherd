import { describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import type { Rule } from "../../utils/rules/types";
import { seedSampleRulesOnFirstInstall } from "./rules";

const EXISTING: Rule = {
  id: "existing",
  name: "既存",
  color: "blue",
  conditions: [{ type: "contains", value: "example.com" }],
};

/** 保存されたルールの一覧を読む（fakeBrowser.storage.local の実体のキーは "local:" を除いた "rules"） */
async function storedRules(): Promise<Rule[] | undefined> {
  const { rules } = await fakeBrowser.storage.local.get<{ rules: Rule[] }>("rules");
  return rules;
}

describe("初回インストール時のサンプルルールの投入", () => {
  it("初回インストールで、ルールが1件も無ければサンプルルール3件を投入する", async () => {
    // 前提: reason が install で、ルールが1件も保存されていない
    // 検証: 「⚙設定」「📺️動画」「📃ブログ」の3件がこの順で保存される
    fakeBrowser.reset();

    await seedSampleRulesOnFirstInstall("install");

    const rules = await storedRules();
    expect(rules?.map((rule) => rule.name)).toStrictEqual(["⚙設定", "📺️動画", "📃ブログ"]);
  });

  it("拡張機能の更新（reason が update）では投入しない", async () => {
    // 前提: reason が update で、ルールが1件も保存されていない
    // 検証: ルールの一覧は保存されない（undefined のまま）
    fakeBrowser.reset();

    await seedSampleRulesOnFirstInstall("update");

    await expect(storedRules()).resolves.toBeUndefined();
  });

  it("reason が install でも、既にルールが保存されていれば投入しない", async () => {
    // 前提: reason が install だが、既に1件のルールが保存されている
    // 検証: 保存されたルールは既存の1件のまま変わらない
    fakeBrowser.reset();
    await fakeBrowser.storage.local.set({ rules: [EXISTING] });

    await seedSampleRulesOnFirstInstall("install");

    await expect(storedRules()).resolves.toStrictEqual([EXISTING]);
  });
});
