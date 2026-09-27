import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "TabHerd - Auto Tab Groups",
    permissions: ["storage", "tabGroups", "tabs"],
  },
});
