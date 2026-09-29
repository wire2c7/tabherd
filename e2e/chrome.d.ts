import type { browser } from "wxt/browser";

// serviceWorker.evaluate 等に渡す関数は拡張機能の中で動き、グローバルの chrome を使う。その型を WXT の browser の型で与える
declare global {
  const chrome: typeof browser;
}
