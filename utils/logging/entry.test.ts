import type { LogRecord } from "@logtape/logtape";
import { describe, expect, it } from "vitest";

import { CIRCULAR_REFERENCE, UNSERIALIZABLE_VALUE, toJsonValue, toStoredLogEntry } from "./entry";

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

describe("エラーの原因の保存", () => {
  it("原因の例外（cause）を、入れ子の Error も含めて残す", () => {
    const root = new Error("No group with id: 1.");
    const error = new Error("v1 migration failed", { cause: root });
    expect(toJsonValue(error)).toStrictEqual({
      name: "Error",
      message: "v1 migration failed",
      stack: error.stack,
      cause: { name: "Error", message: "No group with id: 1.", stack: root.stack },
    });
  });

  it("error でない原因もそのまま残す", () => {
    expect(toJsonValue(new Error("失敗", { cause: { tabId: 3 } }))).toMatchObject({ cause: { tabId: 3 } });
  });

  it("aggregateError がまとめた例外を残す", () => {
    const inner = new TypeError("内側");
    const error = new AggregateError([inner], "すべて失敗");
    expect(toJsonValue(error)).toMatchObject({
      name: "AggregateError",
      message: "すべて失敗",
      errors: [{ name: "TypeError", message: "内側", stack: inner.stack }],
    });
  });
});

describe("循環している参照", () => {
  it("cause が自分自身を指していても、外側のエラーの情報を残す", () => {
    const error = new Error("外側");
    error.cause = error;
    expect(toJsonValue(error)).toStrictEqual({
      name: "Error",
      message: "外側",
      stack: error.stack,
      cause: CIRCULAR_REFERENCE,
    });
  });

  it("cause が循環するオブジェクトでも、循環しているところだけを置き換える", () => {
    const cause: Record<string, unknown> = { tabId: 3 };
    cause["self"] = cause;
    expect(toJsonValue(new Error("外側", { cause }))).toMatchObject({
      message: "外側",
      cause: { tabId: 3, self: CIRCULAR_REFERENCE },
    });
  });

  it("同じ値を2か所から参照しているだけなら、置き換えない", () => {
    const tabIds = [1, 2];
    expect(toJsonValue({ tabIds, operation: { tabIds } })).toStrictEqual({
      tabIds: [1, 2],
      operation: { tabIds: [1, 2] },
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

  it("bigInt 等の JSON にできない値は文字列にする", () => {
    expect(toJsonValue({ value: 1n })).toBe("[object Object]");
  });

  it("文字列にもできない値は、例外を投げずに代わりの文字列にする", () => {
    // BigInt を持つ、プロトタイプの無いオブジェクトは JSON.stringify・String のどちらも例外を投げる
    const value: Record<string, unknown> = { value: 1n };
    Object.setPrototypeOf(value, null);
    expect(toJsonValue(value)).toBe(UNSERIALIZABLE_VALUE);
  });
});
