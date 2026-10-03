import { describe, expect, it, vi } from "vitest";

import type { SendClearLogsMessage } from "./messages";
import { isClearLogsMessage, requestClearLogs } from "./messages";

describe("ログの消去の依頼のメッセージ", () => {
  it("消去の依頼を見分ける", () => {
    expect(isClearLogsMessage({ type: "clear-logs" })).toBe(true);
  });

  it.each([null, "clear-logs", {}, { type: "other" }])("ほかの値 %j は消去の依頼として扱わない", (message) => {
    expect(isClearLogsMessage(message)).toBe(false);
  });
});

describe("ログの消去の依頼", () => {
  it("消去の依頼を送り、消し終わったら ok: true を返す", async () => {
    const send = vi.fn<SendClearLogsMessage>().mockResolvedValue({ ok: true });
    await expect(requestClearLogs(send)).resolves.toStrictEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({ type: "clear-logs" });
  });

  it("background が失敗を返したら、そのまま返す", async () => {
    const send = vi.fn<SendClearLogsMessage>().mockResolvedValue({ ok: false, error: "容量不足" });
    await expect(requestClearLogs(send)).resolves.toStrictEqual({ ok: false, error: "容量不足" });
  });

  it("送れなかったら、例外を投げずに ok: false を返す", async () => {
    const send = vi
      .fn<SendClearLogsMessage>()
      .mockRejectedValue(new Error("Could not establish connection. Receiving end does not exist."));
    await expect(requestClearLogs(send)).resolves.toMatchObject({ ok: false });
  });

  it("返事が無ければ ok: false を返す", async () => {
    // 受け取るリスナーが無いときは、返事の値が無い（undefined）。同じ判定を通る null で確かめる
    const send = vi.fn<SendClearLogsMessage>().mockResolvedValue(null);
    await expect(requestClearLogs(send)).resolves.toMatchObject({ ok: false });
  });
});
