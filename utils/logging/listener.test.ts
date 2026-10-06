import { getLogger } from "@logtape/logtape";
import { describe, expect, it } from "vitest";

import { captureLogs } from "./testing/capture";
import { logListenerErrors } from "./listener";

const logger = getLogger(["tabherd", "test"]);

describe("イベントのリスナーの例外", () => {
  it("投げた例外をログに残してから投げ直す", () => {
    // 前提: ラップしたリスナーが呼ぶたびに例外を投げる
    // 検証: 呼び出し元には同じ例外が投げ直され、ログに1件、レベル error・properties.error にその例外が残る
    const records = captureLogs();
    const error = new Error("リスナーの失敗");
    const listener = logListenerErrors(logger, () => {
      throw error;
    });

    expect(() => {
      listener();
    }).toThrow(error);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ level: "error", properties: { error } });
  });

  it("例外を投げなければ、引数を渡して戻り値を返し、ログに残さない", () => {
    // 前提: ラップしたリスナーが例外を投げず、引数2つ（1, 2）を受け取って加算する
    // 検証: 戻り値が引数の合計（3）になり、ログは1件も残らない
    const records = captureLogs();
    const listener = logListenerErrors(logger, (a: number, b: number) => a + b);

    expect(listener(1, 2)).toBe(3);
    expect(records).toStrictEqual([]);
  });
});
