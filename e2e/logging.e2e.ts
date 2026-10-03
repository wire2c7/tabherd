import { readFile } from "node:fs/promises";

import type { StoredLogEntry } from "../utils/logging/storage";
import { expect, rule, test } from "./fixtures";

// テストの名前は openspec/specs/diagnostic-logging/spec.md の Requirement（describe）と Scenario（test）に対応させる

const dev = rule("dev", "開発", "blue");

const UNCAUGHT_MESSAGE = "E2E でわざと起こしたエラー";

/**
 * わざと捕捉されないエラーを起こしたときに、ロガーが console に error で出すメッセージ（リリース版でも出る）。
 * わざと起こす describe の中だけで test.use に渡す。ファイル全体に渡すと、ほかのテストで起きた本物の捕捉されないエラーも見逃す
 */
const UNCAUGHT_ERROR_LOGS = [/捕捉されない(?:エラー| Promise の拒否)が起きました/u];

test.describe("エラー時のログの保存", () => {
  test.use({ expectedErrors: UNCAUGHT_ERROR_LOGS });

  test("捕捉されないエラー（Promise の拒否）", async ({ serviceWorker, setRules, groupOf, openTab }) => {
    async function storedLogs(): Promise<StoredLogEntry[]> {
      return serviceWorker.evaluate(async () => {
        const { logs } = await chrome.storage.local.get<{ logs?: StoredLogEntry[] }>("logs");
        return logs ?? [];
      });
    }

    await setRules([dev]);
    await openTab("/dev/secret-path");
    await expect.poll(async () => groupOf("/dev/secret-path")).toMatchObject({ title: "開発" });

    // エラーが起きていないあいだは保存しない
    expect(await storedLogs()).toStrictEqual([]);

    await serviceWorker.evaluate((message) => {
      // Service Worker の中で、拡張機能のコードが捕捉しない Promise の拒否を起こす
      void Promise.reject(new Error(message));
    }, UNCAUGHT_MESSAGE);

    await expect
      .poll(async () => {
        const logs = await storedLogs();
        return logs.at(-1)?.level;
      })
      .toBe("error");
    const logs = await storedLogs();
    expect(logs.at(-1)).toMatchObject({
      category: "tabherd.background",
      properties: { error: { name: "Error", message: UNCAUGHT_MESSAGE } },
    });
    // 直前のタブの判定のログも一緒に保存される
    expect(logs.some((entry) => entry.category === "tabherd.grouping" && entry.level === "debug")).toBe(true);
    // URL・グループ名は記録しない
    const text = JSON.stringify(logs);
    for (const secret of ["secret-path", "127.0.0.1", "開発"]) {
      expect(text).not.toContain(secret);
    }
  });

  test("捕捉されないエラー（例外）", async ({ serviceWorker }) => {
    await serviceWorker.evaluate((message) => {
      // evaluate の中で投げると Playwright が受け取るため、タイマーの中で投げる
      setTimeout(() => {
        throw new Error(message);
      }, 0);
    }, UNCAUGHT_MESSAGE);

    await expect
      .poll(async () =>
        serviceWorker.evaluate(async () => {
          const { logs } = await chrome.storage.local.get<{ logs?: StoredLogEntry[] }>("logs");
          return logs?.at(-1);
        }),
      )
      .toMatchObject({
        level: "error",
        category: "tabherd.background",
        properties: {
          error: { name: "Error", message: UNCAUGHT_MESSAGE },
          message: expect.stringContaining(UNCAUGHT_MESSAGE),
          lineno: expect.any(Number),
        },
      });
  });
});

test.describe("ログの説明", () => {
  test("オプションページを開く", async ({ openSettings }) => {
    const page = await openSettings("options");
    const section = page.getByRole("region", { name: "ログ" });

    await expect(section).toContainText("記録するもの");
    await expect(section).toContainText("記録しないもの");
    await expect(section).toContainText("タブの URL・タイトル");
    await expect(section).toContainText("自動で送信されることはありません");
  });
});

test.describe("ログの書き出しと消去", () => {
  test("ログを書き出して消去する", async ({ serviceWorker, openSettings }) => {
    const entry: StoredLogEntry = {
      timestamp: "2026-10-02T01:00:00.000Z",
      level: "warning",
      category: "tabherd.grouping",
      message: "グループの操作に失敗しました",
      properties: {},
    };
    await serviceWorker.evaluate(async (logs) => chrome.storage.local.set({ logs }), [entry]);
    const page = await openSettings("options");
    await expect(page.getByText("保存されたログ：1 件")).toBeVisible();

    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "ログを保存" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^tabherd-logs-\d{8}-\d{6}\.json$/u);
    const exported: unknown = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported).toMatchObject({
      extensionVersion: expect.any(String),
      // Chromium の拡張機能のページでは User-Agent Client Hints が使え、User-Agent に戻らない
      browser: {
        brand: expect.any(String),
        version: expect.stringMatching(/^\d+\.\d+\.\d+\.\d+$/u),
        source: "userAgentData",
      },
      logs: [entry],
    });

    await page.getByRole("button", { name: "ログを消去" }).click();
    await expect(page.getByText("保存されたログ：0 件")).toBeVisible();
  });
});

test.describe("ログの消去", () => {
  test.use({ expectedErrors: UNCAUGHT_ERROR_LOGS });

  // 「保存の途中で消去する」の競合は、ブラウザの中では毎回同じタイミングで起こせないため、単体テスト（utils/logging/stored-sink.test.ts）で確かめる。
  // ここでは、消去の前のログ（保存済みのもの、メモリに溜めたもの）が、消去の後の保存に混ざらないことを確かめる
  test("消去の前のログが、消去の後の保存に混ざらない", async ({
    serviceWorker,
    setRules,
    groupOf,
    openTab,
    openSettings,
  }) => {
    async function storedLogs(): Promise<StoredLogEntry[]> {
      return serviceWorker.evaluate(async () => {
        const { logs } = await chrome.storage.local.get<{ logs?: StoredLogEntry[] }>("logs");
        return logs ?? [];
      });
    }
    async function rejectInWorker(message: string): Promise<void> {
      await serviceWorker.evaluate((text) => {
        void Promise.reject(new Error(text));
      }, message);
    }

    await setRules([dev]);
    await openTab("/dev/before-clear");
    await expect.poll(async () => groupOf("/dev/before-clear")).toMatchObject({ title: "開発" });
    await rejectInWorker("消去の前のエラー");
    const page = await openSettings("options");
    // ボタンはログが0件のあいだ押せないため、click は消去の前のエラーの保存が終わってから押す
    const clearedAt = new Date().toISOString();
    await page.getByRole("button", { name: "ログを消去" }).click();
    await expect(page.getByText("保存されたログ：0 件")).toBeVisible();

    await rejectInWorker("消去の後のエラー");

    // 保存されたエラーは消去の後のものだけ（消去の前のエラーが、消去の後に書き戻されていない）
    await expect
      .poll(async () => {
        const logs = await storedLogs();
        return logs.filter((entry) => entry.level === "error").map((entry) => entry.properties["error"]);
      })
      .toStrictEqual([expect.objectContaining({ message: "消去の後のエラー" })]);
    // エラーの直前の文脈としてメモリに溜めていた、消去の前のログも保存されていない
    const logs = await storedLogs();
    expect(logs.filter((entry) => entry.timestamp < clearedAt)).toStrictEqual([]);
  });
});
