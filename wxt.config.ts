import { defineConfig } from "wxt";

export default defineConfig({
  // import を書かずに WXT の API を使えないようにする（docs/adr/0021-isolate-framework-dependencies.md）
  imports: false,
  manifest: {
    name: "TabHerd - Auto Tab Groups",
    permissions: ["storage", "tabGroups", "tabs"],
    // 決め方と上げ方は docs/adr/0019-minimum-chrome-version.md
    minimum_chrome_version: "140",
  },
});
