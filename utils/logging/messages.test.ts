import { describe, expect, it, vi } from "vitest";

import type { SendLogsRequest } from "./messages";
import { isLogsRequest, requestLogs } from "./messages";

describe("ログについての依頼のメッセージ", () => {
  it.each(["clear-logs", "settle-logs"])("依頼 %s を見分ける", (type) => {
    expect(isLogsRequest({ type })).toBe(true);
  });

  it.each([null, "clear-logs", {}, { type: "other" }])("ほかの値 %j は依頼として扱わない", (message) => {
    expect(isLogsRequest(message)).toBe(false);
  });
});

describe("ログについての依頼", () => {
  it("依頼を送り、終わったら ok: true を返す", async () => {
    const send = vi.fn<SendLogsRequest>().mockResolvedValue({ ok: true });
    await expect(requestLogs(send, "clear-logs")).resolves.toStrictEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({ type: "clear-logs" });
  });

  it("background が失敗を返したら、そのまま返す", async () => {
    const send = vi.fn<SendLogsRequest>().mockResolvedValue({ ok: false, error: "容量不足" });
    await expect(requestLogs(send, "clear-logs")).resolves.toStrictEqual({ ok: false, error: "容量不足" });
  });

  it("送れなかったら、例外を投げずに ok: false を返す", async () => {
    const send = vi
      .fn<SendLogsRequest>()
      .mockRejectedValue(new Error("Could not establish connection. Receiving end does not exist."));
    await expect(requestLogs(send, "settle-logs")).resolves.toMatchObject({ ok: false });
  });

  it("返事が無ければ ok: false を返す", async () => {
    // 受け取るリスナーが無いときは、返事の値が無い（undefined）。同じ判定を通る null で確かめる
    const send = vi.fn<SendLogsRequest>().mockResolvedValue(null);
    await expect(requestLogs(send, "settle-logs")).resolves.toMatchObject({ ok: false });
  });
});
