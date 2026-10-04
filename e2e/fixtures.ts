import { once } from "node:events";
import { createServer } from "node:http";
import path from "node:path";

import type { BrowserContext, Page, Worker } from "@playwright/test";
import { test as base, chromium, expect } from "@playwright/test";

import type { GroupColor, Rule } from "../utils/rules/types";

export { expect } from "@playwright/test";

/** `pnpm e2e` がビルドする拡張機能の出力 */
const extensionDir = path.resolve(import.meta.dirname, "../.output/chrome-mv3");

/** テスト用のローカルの HTTP サーバー。どのパスにも、パスを表示するだけの HTML を返す */
export interface TestServer {
  /** `http://127.0.0.1:<port>` */
  origin: string;
}

/** タブグループ */
export interface GroupState {
  id: number;
  title: string;
  color: string;
}

/** タブバー上のタブ */
export interface TabState {
  id: number;
  windowId: number;
  /** http(s) のページは URL のパス（`/dev/1` 等）、それ以外（`about:blank` 等）は URL そのもの */
  path: string;
  pinned: boolean;
  /** 入っているタブグループ。入っていなければ null */
  group: GroupState | null;
}

/** ウィンドウと、そのタブ（タブバーの左から順） */
export interface WindowState {
  id: number;
  tabs: TabState[];
}

/** 設定画面のページ */
export type SettingsPageName = "popup" | "options";

interface Options {
  /** テストでわざと起こすエラー。Service Worker・ページのエラーのうち、これに一致するものは失敗として扱わない */
  expectedErrors: readonly RegExp[];
}

interface Fixtures {
  /** 拡張機能を読み込んだ Chromium の永続コンテキスト。テストごとに一時的なプロフィールで起動する */
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  server: TestServer;
  /** ルールの一覧をストレージに保存する。設定画面での保存と同じく、バックグラウンドの watch に通知される */
  setRules: (rules: readonly Rule[]) => Promise<void>;
  /** 形を問わず値をルールの保存先（WXT の storage の `local:rules` は chrome.storage.local の `rules`）に書く。壊れた保存値を作るのに使う */
  setStoredRules: (value: unknown) => Promise<void>;
  /** ストレージに保存されたルールの一覧 */
  storedRules: () => Promise<Rule[]>;
  /** ストレージに保存されたルールのグループ名（一覧の順） */
  storedNames: () => Promise<string[]>;
  /** 通常のウィンドウと、そのタブ・グループの一覧 */
  windows: () => Promise<WindowState[]>;
  /** パスが path のタブ。すべてのウィンドウから探し、なければ undefined */
  findTab: (path: string) => Promise<TabState | undefined>;
  /** パスが path のタブの ID。なければ失敗させる */
  tabIdOf: (path: string) => Promise<number>;
  /** パスが path のタブが入っているグループ。グループに入っていなければ null、タブがなければ undefined */
  groupOf: (path: string) => Promise<GroupState | null | undefined>;
  /** ウィンドウごとの、タブバー上のグループのタイトルの並び（左から順） */
  groupOrders: () => Promise<string[][]>;
  /** ウィンドウごとの、タブバー上のタブ（左から順）。グループに入っているタブは `[開発] /dev/1`、入っていなければ `/dev/1` の形 */
  tabLayouts: () => Promise<string[][]>;
  /** テスト用のサーバーの path を新しいタブで開く */
  openTab: (path: string) => Promise<Page>;
  /** tabIds のタブを、ルールと関係なく手で作るのと同じようにタブグループにまとめる。グループの ID を返す */
  groupTabsManually: (tabIds: readonly number[], title: string) => Promise<number>;
  /** 設定画面（ポップアップ・オプションページ）をタブで開き、ルールの読み込みを待つ。ポップアップは幅 400px で開く */
  openSettings: (name: SettingsPageName) => Promise<Page>;
}

/** `/<id>/` を含む URL に一致する、部分一致の条件を1つ持つルール */
export function rule(id: string, name: string, color: GroupColor): Rule {
  return { id, name, color, conditions: [{ type: "contains", value: `/${id}/` }] };
}

/** 設定画面の一覧に表示されているグループ名（上から順） */
export async function shownNames(page: Page): Promise<string[]> {
  return page.getByLabel("グループ名").evaluateAll((inputs: HTMLInputElement[]) => inputs.map((input) => input.value));
}

/** タブバー上のグループのタイトルを左から順に並べる。同じグループのタブは1つにまとめる */
function groupOrder(window: WindowState): string[] {
  const titles: string[] = [];
  let lastGroupId: number | null = null;
  for (const { group } of window.tabs) {
    if (group !== null && group.id !== lastGroupId) {
      titles.push(group.title);
    }
    lastGroupId = group?.id ?? null;
  }
  return titles;
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
export const test = base.extend<Options & Fixtures>({
  expectedErrors: [[], { option: true }],
  context: async ({ headless, expectedErrors }, provide) => {
    const context = await chromium.launchPersistentContext("", {
      executablePath: chromiumPath(),
      headless,
      args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });
    const errors: string[] = [];
    collectErrors(context, errors);

    try {
      await provide(context);
      const unexpected = errors.filter((error) => !expectedErrors.some((pattern) => pattern.test(error)));
      expect(unexpected, "Service Worker とページでエラーが出ていない").toStrictEqual([]);
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
  setStoredRules: async ({ serviceWorker }, provide) => {
    await provide(async (stored) =>
      serviceWorker.evaluate(async (value) => chrome.storage.local.set({ rules: value }), stored),
    );
  },
  setRules: async ({ setStoredRules }, provide) => {
    await provide(setStoredRules);
  },
  storedRules: async ({ serviceWorker }, provide) => {
    await provide(async () =>
      serviceWorker.evaluate(async () => {
        const { rules } = await chrome.storage.local.get<{ rules?: Rule[] }>("rules");
        return rules ?? [];
      }),
    );
  },
  storedNames: async ({ storedRules }, provide) => {
    await provide(async () => {
      const rules = await storedRules();
      return rules.map((stored) => stored.name);
    });
  },
  windows: async ({ serviceWorker }, provide) => {
    await provide(async () =>
      // 関数は Service Worker の中で動くため、外の変数・関数を使わない
      serviceWorker.evaluate(async () => {
        const allGroups = await chrome.tabGroups.query({});
        const groups = new Map(
          allGroups.map((group) => [group.id, { id: group.id, title: group.title ?? "", color: group.color }]),
        );
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
        return windows.map((window) => ({
          id: window.id ?? chrome.windows.WINDOW_ID_NONE,
          tabs: (window.tabs ?? []).map((tab) => {
            const url = tab.url ?? "";
            return {
              id: tab.id ?? chrome.tabs.TAB_ID_NONE,
              windowId: tab.windowId,
              path: /^https?:/u.test(url) ? new URL(url).pathname : url,
              pinned: tab.pinned,
              group: groups.get(tab.groupId) ?? null,
            };
          }),
        }));
      }),
    );
  },
  findTab: async ({ windows }, provide) => {
    await provide(async (tabPath) => {
      const all = await windows();
      return all.flatMap((window) => window.tabs).find((tab) => tab.path === tabPath);
    });
  },
  tabIdOf: async ({ findTab }, provide) => {
    await provide(async (tabPath) => {
      const tab = await findTab(tabPath);
      if (tab === undefined) {
        throw new Error(`${tabPath} のタブがありません`);
      }
      return tab.id;
    });
  },
  groupOf: async ({ findTab }, provide) => {
    await provide(async (tabPath) => {
      const tab = await findTab(tabPath);
      return tab?.group;
    });
  },
  groupOrders: async ({ windows }, provide) => {
    await provide(async () => {
      const all = await windows();
      return all.map((window) => groupOrder(window));
    });
  },
  tabLayouts: async ({ windows }, provide) => {
    await provide(async () => {
      const all = await windows();
      return all.map((window) =>
        window.tabs.map((tab) => (tab.group === null ? tab.path : `[${tab.group.title}] ${tab.path}`)),
      );
    });
  },
  openTab: async ({ context, server }, provide) => {
    await provide(async (tabPath) => {
      const page = await context.newPage();
      await page.goto(`${server.origin}${tabPath}`);
      return page;
    });
  },
  groupTabsManually: async ({ serviceWorker }, provide) => {
    await provide(async (tabIds, title) =>
      serviceWorker.evaluate(
        async ([ids, groupTitle]) => {
          const [first, ...rest] = ids;
          if (first === undefined) {
            throw new Error("グループにまとめるタブがありません");
          }
          const groupId = await chrome.tabs.group({ tabIds: [first, ...rest] });
          await chrome.tabGroups.update(groupId, { title: groupTitle, color: "grey" });
          return groupId;
        },
        [tabIds, title] as const,
      ),
    );
  },
  openSettings: async ({ context, extensionId }, provide) => {
    await provide(async (name) => {
      const page = await context.newPage();
      if (name === "popup") {
        // Chrome のポップアップの幅（entrypoints/popup/style.css）と最大の高さ
        await page.setViewportSize({ width: 400, height: 600 });
      }
      await page.goto(`chrome-extension://${extensionId}/${name}.html`);
      await expect(page.getByRole("button", { name: "＋ ルールを追加" })).toBeEnabled();
      return page;
    });
  },
});
