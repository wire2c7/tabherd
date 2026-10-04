import { describe, expect, it } from "vitest";

import type { StoredLogEntry } from "../../utils/logging/storage";
import type { BrowserInfo } from "./browser";
import { buildLogExport } from "./export";

const BROWSER: BrowserInfo = { brand: "Google Chrome", version: "141.0.7390.54", source: "userAgentData" };

const LOG: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "warning",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: { operation: { type: "ungroup", tabIds: [12] } },
};

describe("書き出すログのファイル", () => {
  const environment = { extensionVersion: "0.1.0", browser: BROWSER, now: new Date("2026-10-02T01:02:03.456Z") };

  it("ログに拡張機能のバージョン、ブラウザの種類とバージョン、日時を添える", () => {
    const { content } = buildLogExport([LOG], environment);
    expect(JSON.parse(content)).toStrictEqual({
      extensionVersion: "0.1.0",
      browser: BROWSER,
      exportedAt: "2026-10-02T01:02:03.456Z",
      logs: [LOG],
    });
  });

  it("ログが無くても書き出せる", () => {
    const { content } = buildLogExport([], environment);
    expect(JSON.parse(content)).toHaveProperty("logs", []);
  });

  it("ファイル名に書き出した日時をローカルの時刻で入れる", () => {
    // テストを実行する環境のタイムゾーンによらないよう、ローカルの時刻で日時を作る
    const now = new Date(2026, 9, 2, 9, 5, 7);
    expect(buildLogExport([], { ...environment, now }).fileName).toBe("tabherd-logs-20261002-090507.json");
  });
});
