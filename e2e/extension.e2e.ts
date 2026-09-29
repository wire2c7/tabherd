import { expect, test } from "./fixtures";

test("拡張機能が読み込まれ、Service Worker が起動する", async ({ serviceWorker, extensionId }) => {
  // パッケージ化していない拡張機能の ID は a〜p の 32 文字
  expect(extensionId).toMatch(/^[a-p]{32}$/u);
  expect(await serviceWorker.evaluate(() => typeof chrome.tabGroups.query)).toBe("function");
});
