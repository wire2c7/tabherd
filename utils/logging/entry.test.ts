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
    // 前提: レベル warning のログレコード
    // 検証: timestamp が ISO 文字列、category がドット区切りの文字列になる
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
    // 前提: メッセージのテンプレートに数値・オブジェクト・Error が混じる
    // 検証: それぞれが文字列化されてテンプレートに埋め込まれる
    const entry = toStoredLogEntry(
      record({ message: ["タブ ", 12, " の操作 ", { type: "ungroup" }, " が失敗: ", new TypeError("理由"), ""] }),
    );
    expect(entry.message).toBe('タブ 12 の操作 {"type":"ungroup"} が失敗: TypeError: 理由');
  });

  it("プロパティの Error を名前・メッセージ・スタックトレースにする", () => {
    // 前提: properties に Error と通常の値（tabIds）が混在する
    // 検証: Error だけが name・message・stack のオブジェクトになり、他の値はそのまま残る
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
    // 前提: cause に別の Error を持つ Error
    // 検証: 戻り値の cause にも、入れ子の Error の name・message・stack が残る
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
    // 前提: cause が Error ではなく通常のオブジェクト
    // 検証: cause がそのままのオブジェクトとして残る
    expect(toJsonValue(new Error("失敗", { cause: { tabId: 3 } }))).toMatchObject({ cause: { tabId: 3 } });
  });

  it("aggregateError がまとめた例外を残す", () => {
    // 前提: AggregateError が内側に TypeError を1件持つ
    // 検証: errors 配列に内側の Error の name・message・stack が残る
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
    // 前提: error.cause が自分自身を指す循環参照
    // 検証: 外側の name・message・stack は残り、cause は CIRCULAR_REFERENCE に置き換わる
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
    // 前提: cause オブジェクトの self プロパティが自分自身を指す
    // 検証: tabId は残り、self だけが CIRCULAR_REFERENCE に置き換わる
    const cause: Record<string, unknown> = { tabId: 3 };
    cause["self"] = cause;
    expect(toJsonValue(new Error("外側", { cause }))).toMatchObject({
      message: "外側",
      cause: { tabId: 3, self: CIRCULAR_REFERENCE },
    });
  });

  it("同じ値を2か所から参照しているだけなら、置き換えない", () => {
    // 前提: 同じ配列を tabIds と operation.tabIds の2箇所から参照する（循環はしていない）
    // 検証: 置き換えずに、どちらも同じ内容の配列として残る
    const tabIds = [1, 2];
    expect(toJsonValue({ tabIds, operation: { tabIds } })).toStrictEqual({
      tabIds: [1, 2],
      operation: { tabIds: [1, 2] },
    });
  });
});

describe("値を JSON にできる形に変える", () => {
  it("入れ子の Error も変える", () => {
    // 前提: オブジェクトのプロパティ（cause）に Error を持つ
    // 検証: その Error が name・message・stack のオブジェクトに変わる
    const error = new Error("内側");
    expect(toJsonValue({ cause: error })).toStrictEqual({
      cause: { name: "Error", message: "内側", stack: error.stack },
    });
  });

  it("関数は JSON にできないため null にする", () => {
    // 前提: 値が関数
    // 検証: null を返す
    expect(toJsonValue(() => 1)).toBeNull();
  });

  it("bigInt は、ほかのプロパティを残したまま10進の文字列にする", () => {
    // 前提: cause.id が bigInt
    // 検証: bigInt が10進の文字列になり、他のプロパティ（Error の name・message・stack）は変わらない
    const error = new Error("外側", { cause: { id: 12_345_678_901_234_567_890n } });
    expect(toJsonValue({ error })).toStrictEqual({
      error: { name: "Error", message: "外側", stack: error.stack, cause: { id: "12345678901234567890" } },
    });
  });

  it("読むと例外を投げるプロパティがあって JSON にできない値は、文字列にする", () => {
    // 前提: ゲッターが例外を投げるプロパティを持つオブジェクト（JSON.stringify が失敗する）
    // 検証: 例外を投げずに String() した結果（"[object Object]"）を返す
    const value = {
      get broken(): never {
        throw new Error("読めない");
      },
    };
    expect(toJsonValue(value)).toBe("[object Object]");
  });

  it("文字列にもできない値は、例外を投げずに代わりの文字列にする", () => {
    // 前提/検証: プロトタイプが無くゲッターが例外を投げ JSON.stringify・String のどちらも失敗する値は、UNSERIALIZABLE_VALUE を返す
    const value = Object.create(null, {
      broken: {
        enumerable: true,
        get: () => {
          throw new Error("読めない");
        },
      },
    }) as unknown;
    expect(toJsonValue(value)).toBe(UNSERIALIZABLE_VALUE);
  });
});
