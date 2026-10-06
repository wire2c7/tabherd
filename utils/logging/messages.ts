/**
 * オプションページから background への、端末に保存したログについての依頼。
 * - clear-logs: 保存したログを消す
 * - settle-logs: 依頼までに保存すると決まったログの保存が終わるのを待つ
 */
export interface LogsRequest {
  type: "clear-logs" | "settle-logs";
}

/** ログについての依頼への返事 */
export type LogsResponse = { ok: true } | { ok: false; error: string };

const LOGS_REQUEST_TYPES: ReadonlySet<unknown> = new Set<LogsRequest["type"]>(["clear-logs", "settle-logs"]);

/**
 * 受け取った値が LogsRequest か判定する。
 *
 * @param message - 判定する値
 * @returns message が LogsRequest なら true
 */
export function isLogsRequest(message: unknown): message is LogsRequest {
  return typeof message === "object" && message !== null && "type" in message && LOGS_REQUEST_TYPES.has(message.type);
}

/** 依頼を送る関数（runtime.sendMessage） */
export type SendLogsRequest = (message: LogsRequest) => Promise<unknown>;

/**
 * background にログについての依頼を送る。
 *
 * @param send - 依頼を送る関数（runtime.sendMessage）
 * @param type - 送る依頼の種類
 * @returns 終わったら ok: true、失敗したら ok: false とその理由
 * @remarks background が依頼を受けられない（Service Worker が止まる途中等）ときも例外を投げず、ok: false を返す
 */
export async function requestLogs(send: SendLogsRequest, type: LogsRequest["type"]): Promise<LogsResponse> {
  try {
    const response = await send({ type });
    if (isLogsResponse(response)) {
      return response;
    }
    // 受け取るリスナーが無いと undefined が返る
    return { ok: false, error: `想定しない返事: ${String(response)}` };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function isLogsResponse(response: unknown): response is LogsResponse {
  return typeof response === "object" && response !== null && "ok" in response && typeof response.ok === "boolean";
}
