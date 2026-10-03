import type { LogRecord } from "@logtape/logtape";
import { describe, expect, it } from "vitest";

import { UNSERIALIZABLE_VALUE, toJsonValue, toStoredLogEntry } from "./entry";

function record(overrides: Partial<LogRecord>): LogRecord {
  return {
    category: ["tabherd", "grouping"],
    level: "info",
    message: ["メッセージ"],
    rawMessage: "メッセージ",
    timestamp: Date.UTC(2026, 9, 2, 1, 2, 3),
    properties: {},
    ...overrides,
  };
}

describe("ログを保存する形に変える", () => {
  it("時刻・レベル・カテゴリを変える", () => {
    const entry = toStoredLogEntry(record({ level: "warning" }));
    expect(entry).toStrictEqual({
      timestamp: "2026-10-02T01:02:03.000Z",
      level: "warning",
      category: "tabherd.grouping",
      message: "メッセージ",
      properties: {},
    });
  });

  it("メッセージのテンプレートに値を埋める", () => {
    const entry = toStoredLogEntry(
      record({ message: ["タブ ", 12, " の操作 ", { type: "ungroup" }, " が失敗: ", new TypeError("理由"), ""] }),
    );
    expect(entry.message).toBe('タブ 12 の操作 {"type":"ungroup"} が失敗: TypeError: 理由');
  });

  it("プロパティの Error を名前・メッセージ・スタックトレースにする", () => {
    const error = new Error("No group with id: 1.");
    const entry = toStoredLogEntry(record({ properties: { error, tabIds: [1, 2] } }));
    expect(entry.properties).toStrictEqual({
      error: { name: "Error", message: "No group with id: 1.", stack: error.stack },
      tabIds: [1, 2],
    });
  });
});

describe("値を JSON にできる形に変える", () => {
  it("入れ子の Error も変える", () => {
    const error = new Error("内側");
    expect(toJsonValue({ cause: error })).toStrictEqual({
      cause: { name: "Error", message: "内側", stack: error.stack },
    });
  });

  it("関数は JSON にできないため null にする", () => {
    expect(toJsonValue(() => 1)).toBeNull();
  });

  it("循環する参照は文字列にする", () => {
    const value: Record<string, unknown> = {};
    value["self"] = value;
    expect(toJsonValue(value)).toBe("[object Object]");
  });

  it("文字列にもできない値は、例外を投げずに代わりの文字列にする", () => {
    // プロトタイプの無い、循環するオブジェクトは JSON.stringify・String のどちらも例外を投げる
    const value: Record<string, unknown> = {};
    Object.setPrototypeOf(value, null);
    value["self"] = value;
    expect(toJsonValue(value)).toBe(UNSERIALIZABLE_VALUE);
  });
});
