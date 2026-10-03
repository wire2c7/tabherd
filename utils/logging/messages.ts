/** オプションページから background へ、端末に保存したログの消去を依頼するメッセージ */
export interface ClearLogsMessage {
  type: "clear-logs";
}

/** ログの消去の依頼への返事 */
export type ClearLogsResponse = { ok: true } | { ok: false; error: string };

export function isClearLogsMessage(message: unknown): message is ClearLogsMessage {
  return typeof message === "object" && message !== null && "type" in message && message.type === "clear-logs";
}

/** 消去の依頼を送る関数（runtime.sendMessage） */
export type SendClearLogsMessage = (message: ClearLogsMessage) => Promise<unknown>;

/**
 * background にログの消去を依頼し、消し終わったら ok: true を返す。
 * background が依頼を受けられない（Service Worker が止まる途中等）ときも例外を投げず、ok: false を返す
 */
export async function requestClearLogs(send: SendClearLogsMessage): Promise<ClearLogsResponse> {
  try {
    const response = await send({ type: "clear-logs" });
    if (isClearLogsResponse(response)) {
      return response;
    }
    // 受け取るリスナーが無いと undefined が返る
    return { ok: false, error: `想定しない返事: ${String(response)}` };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function isClearLogsResponse(response: unknown): response is ClearLogsResponse {
  return typeof response === "object" && response !== null && "ok" in response && typeof response.ok === "boolean";
}
