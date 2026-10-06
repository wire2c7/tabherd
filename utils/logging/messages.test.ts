import { describe, expect, it, vi } from "vitest";

import type { SendLogsRequest } from "./messages";
import { isLogsRequest, requestLogs } from "./messages";

describe("ログについての依頼のメッセージ", () => {
  it.each(["clear-logs", "settle-logs"])("依頼 %s を見分ける", (type) => {
    // 前提: type が clear-logs または settle-logs のオブジェクト
    // 検証: 依頼として true を返す
    expect(isLogsRequest({ type })).toBe(true);
  });

  it.each([null, "clear-logs", {}, { type: "other" }])("ほかの値 %j は依頼として扱わない", (message) => {
    // 前提: null・文字列・空オブジェクト・type が未知の文字列のオブジェクト
    // 検証: いずれも依頼ではないとして false を返す
    expect(isLogsRequest(message)).toBe(false);
  });
});

describe("ログについての依頼", () => {
  it("依頼を送り、終わったら ok: true を返す", async () => {
    // 前提: 送信先（send）が { ok: true } を返す
    // 検証: requestLogs が { ok: true } を返し、send が { type: "clear-logs" } で呼ばれる
    const send = vi.fn<SendLogsRequest>().mockResolvedValue({ ok: true });
    await expect(requestLogs(send, "clear-logs")).resolves.toStrictEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({ type: "clear-logs" });
  });

  it("background が失敗を返したら、そのまま返す", async () => {
    // 前提: 送信先（send）が { ok: false, error } を返す
    // 検証: requestLogs がその失敗の値をそのまま返す
    const send = vi.fn<SendLogsRequest>().mockResolvedValue({ ok: false, error: "容量不足" });
    await expect(requestLogs(send, "clear-logs")).resolves.toStrictEqual({ ok: false, error: "容量不足" });
  });

  it("送れなかったら、例外を投げずに ok: false を返す", async () => {
    // 前提: 送信先（send）が接続エラーの例外を投げる
    // 検証: requestLogs は例外を投げ直さず、{ ok: false } を返す
    const send = vi
      .fn<SendLogsRequest>()
      .mockRejectedValue(new Error("Could not establish connection. Receiving end does not exist."));
    await expect(requestLogs(send, "settle-logs")).resolves.toMatchObject({ ok: false });
  });

  it("返事が無ければ ok: false を返す", async () => {
    // 受け取るリスナーが無いときは、返事の値が無い（undefined）。同じ判定を通る null で確かめる
    // 前提: 送信先（send）が null を返す（受け取るリスナーが無いときの undefined と同じ判定を通る）
    // 検証: requestLogs が { ok: false } を返す
    const send = vi.fn<SendLogsRequest>().mockResolvedValue(null);
    await expect(requestLogs(send, "settle-logs")).resolves.toMatchObject({ ok: false });
  });
});
