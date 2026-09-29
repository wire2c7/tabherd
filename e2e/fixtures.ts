import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";

import type { BrowserContext, Worker } from "@playwright/test";
import { test as base, chromium, expect } from "@playwright/test";

export { expect } from "@playwright/test";

/** `pnpm e2e` がビルドする拡張機能の出力 */
const extensionDir = path.resolve(import.meta.dirname, "../.output/chrome-mv3");

/** テスト用のローカルの HTTP サーバー。どのパスにも、パスを表示するだけの HTML を返す */
export interface TestServer {
  /** `http://127.0.0.1:<port>` */
  origin: string;
}

interface Fixtures {
  /** 拡張機能を読み込んだ Chromium の永続コンテキスト。テストごとに一時的なプロフィールで起動する */
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  server: TestServer;
}

/** E2E の devShell が渡す Chromium の実行ファイル（playwright.config.ts で有無を確かめている） */
function chromiumPath(): string {
  const executablePath = process.env["TABHERD_E2E_CHROMIUM"] ?? "";
  if (executablePath === "") {
    throw new Error("TABHERD_E2E_CHROMIUM がありません。`nix develop .#e2e` の中で実行してください");
  }
  return executablePath;
}

/** Service Worker とページのエラーを errors に集める */
function collectErrors(context: BrowserContext, errors: string[]): void {
  function watchWorker(worker: Worker): void {
    worker.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`service worker: ${message.text()}`);
      }
    });
  }
  for (const worker of context.serviceWorkers()) {
    watchWorker(worker);
  }
  context.on("serviceworker", watchWorker);
  context.on("weberror", (error) => errors.push(`page: ${error.error().message}`));
  context.on("console", (message) => {
    if (message.type() === "error" && message.page() !== null) {
      errors.push(`page: ${message.text()}`);
    }
  });
}

// fixture の第2引数（値を渡す関数）は Playwright の例では use だが、React のフックと誤って判定されないよう provide と呼ぶ
export const test = base.extend<Fixtures>({
  context: async ({ headless }, provide) => {
    const context = await chromium.launchPersistentContext("", {
      executablePath: chromiumPath(),
      headless,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });
    const errors: string[] = [];
    collectErrors(context, errors);

    try {
      await provide(context);
      expect(errors, "Service Worker とページでエラーが出ていない").toStrictEqual([]);
    } finally {
      await context.close();
    }
  },
  serviceWorker: async ({ context }, provide) => {
    const [worker] = context.serviceWorkers();
    await provide(worker ?? (await context.waitForEvent("serviceworker")));
  },
  extensionId: async ({ serviceWorker }, provide) => {
    await provide(new URL(serviceWorker.url()).host);
  },
  // oxlint-disable-next-line no-empty-pattern -- Playwright の fixture は、ほかの fixture を使わなくても第1引数を分割代入で受ける必要がある
  server: async ({}, provide) => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      const title = (request.url ?? "/").replaceAll(/[<&]/gu, "");
      response.end(`<!doctype html><title>${title}</title><h1>${title}</h1>`);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("テスト用のサーバーのポートを取得できませんでした");
    }
    await provide({ origin: `http://127.0.0.1:${address.port}` });
    server.close();
  },
});
