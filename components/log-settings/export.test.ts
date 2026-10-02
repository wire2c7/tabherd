import { describe, expect, it } from "vitest";

import type { StoredLogEntry } from "../../utils/logging/storage";
import { buildLogExport, parseBrowserVersion } from "./export";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const LOG: StoredLogEntry = {
  timestamp: "2026-10-02T01:00:00.000Z",
  level: "warning",
  category: "tabherd.grouping",
  message: "グループの操作に失敗しました",
  properties: { operation: { type: "ungroup", tabIds: [12] } },
};

describe("ブラウザの版", () => {
  it("user-Agent から Chrome の版だけを取り出す", () => {
    expect(parseBrowserVersion(USER_AGENT)).toBe("141.0.0.0");
  });

  it("chrome の版が無ければ null を返す", () => {
    expect(parseBrowserVersion("Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBeNull();
  });
});

describe("書き出すログのファイル", () => {
  const environment = { extensionVersion: "0.1.0", userAgent: USER_AGENT, now: new Date("2026-10-02T01:02:03.456Z") };

  it("ログに拡張機能・ブラウザの版と日時を添える", () => {
    const { content } = buildLogExport([LOG], environment);
    expect(JSON.parse(content)).toStrictEqual({
      extensionVersion: "0.1.0",
      browserVersion: "141.0.0.0",
      exportedAt: "2026-10-02T01:02:03.456Z",
      logs: [LOG],
    });
  });

  it("user-Agent の全体は入れない", () => {
    const { content } = buildLogExport([LOG], environment);
    expect(content).not.toContain("Linux");
  });

  it("ログが無くても書き出せる", () => {
    const { content } = buildLogExport([], environment);
    expect(JSON.parse(content)).toHaveProperty("logs", []);
  });

  it("ファイル名に書き出した日時を入れる", () => {
    expect(buildLogExport([], environment).fileName).toBe("tabherd-logs-20261002-010203.json");
  });
});
